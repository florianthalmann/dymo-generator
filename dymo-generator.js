function DymoGenerator(scheduler, $scope) {
	
	var self = this;
	
	this.dymo;
	var currentTopDymo; //the top dymo for the current audio file
	var audioFileChanged = false;
	this.dymoGraph = {"nodes":[], "links":[]};
	this.similarityGraph = {"nodes":[], "links":[]};
	idToDymo = {};
	idToJson = {};
	
	this.features = [createFeature("level"), createFeature("random", 0, 1)];
	
	var maxDepth = 0;
	
	
	this.init = function() {
		
	}
	
	this.getScheduler = function() {
		return scheduler;
	}
	
	this.getRealDmo = function(dmo) {
		return idToDymo[dmo["@id"]];
	}
	
	this.setAudioFileChanged = function() {
		audioFileChanged = true;
		insertTopDymo();
	}
	
	function insertTopDymo() {
		if (self.dymo) {
			var newDymo = new DynamicMusicObject("dymo" + getDymoCount(), scheduler, PARALLEL);
			newDymo.addPart(self.dymo);
			self.dymo = newDymo;
			updateGraphAndMap(self.dymo);
		}
	}
	
	this.addDymo = function(parent, sourcePath) {
		var uri;
		if (parent) {
			uri = parent.getUri();
		}
		var newDymo = new DynamicMusicObject("dymo" + getDymoCount(), scheduler);
		if (!self.dymo) {
			self.dymo = newDymo;
		}
		if (parent) {
			parent.addPart(newDymo);
		}
		if (sourcePath) {
			newDymo.setSourcePath(sourcePath);
		}
		updateGraphAndMap(newDymo);
		return newDymo;
	}
	
	function updateGraphAndMap(dymo) {
		self.dymoGraph = self.dymo.toJsonHierarchyGraph();
		self.similarityGraph = self.dymo.toJsonSimilarityGraph();
		if (dymo) {
			var flatJson = dymo.toFlatJson();
			idToDymo[dymo.getUri()] = dymo;
			idToJson[dymo.getUri()] = flatJson;
			for (var i = 0; i < self.features.length; i++) {
				updateMinMax(dymo, self.features[i]);
			}
		}
	}
	
	function updateMinMax(dymo, feature) {
		var value = dymo.getFeature(feature.name);
		if (!isNaN(value)) {
			if (feature.max == undefined) {
				feature.min = value;
				feature.max = value;
			} else {
				feature.min = Math.min(value, feature.min);
				feature.max = Math.max(value, feature.max);
			}
		}
	}
	
	function getDymoCount() {
		return Object.keys(idToDymo).length;
	}
	
	this.addFeature = function(name, data) {
		//iterate through all levels and add averages
		var feature = getFeature(name);
		for (var i = 0; i < this.dymoGraph.nodes.length; i++) {
			var currentTime = this.dymoGraph.nodes[i]["time"].value;
			var currentDuration = this.dymoGraph.nodes[i]["duration"].value;
			var currentValues = data.filter(
				function(x){return currentTime <= x.time.value && x.time.value < currentTime+currentDuration}
			);
			var value = 0;
			if ($scope.selectedFeatureMode.name == "first") {
				value = currentValues[0].value[0];
			} else if ($scope.selectedFeatureMode.name == "mean") {
				value = currentValues.reduce(function(sum, i) { return sum + i.value[0]; }, 0) / currentValues.length;
			} else if ($scope.selectedFeatureMode.name == "median") {
				currentValues.sort(function(a, b) { return a.value[0] - b.value[0]; });
				var middleIndex = Math.floor(currentValues.length/2);
				value = currentValues[middleIndex].value[0];
				if (currentValues.length % 2 == 0) {
					value += currentValues[middleIndex-1].value[0];
				}
			}
			setDymoFeature(this.getRealDmo(this.dymoGraph.nodes[i]), feature, value);
		}
		updateGraphAndMap();
	}
	
	this.addSegmentation = function(segments, fileName) {
		if (getDymoCount() == 0) {
			currentTopDymo = addDymo(undefined, $scope.getFullSourcePath());
		} else if (audioFileChanged) {
			currentTopDymo = addDymo(self.dymo, $scope.getFullSourcePath());
			maxDepth = currentTopDymo.getLevel();
			audioFileChanged = false;
		}
		for (var i = 0; i < segments.length-1; i++) {
			parent = getSuitableParent(segments[i].time.value);
			var newDmo = addDymo(parent);
			var startTime = segments[i].time.value;
			setDymoFeature(newDmo, "time", startTime);
			setDymoFeature(newDmo, "duration", segments[i+1].time.value - startTime);
			if (segments[i].label) {
				setDymoFeature(newDmo, "segmentLabel", segments[i].label.value);
			}
			updateParentDuration(parent, newDmo);
		}
		updateGraphAndMap();
		maxDepth++;
	}
	
	function getSuitableParent(time) {
		var nextCandidate = currentTopDymo;
		var depth = currentTopDymo.getLevel();
		while (depth < maxDepth) {
			var parts = nextCandidate.getParts();
			if (parts.length > 0) {
				for (var i = 0; i < parts.length; i++) {
					if (parts[i].getFeature("time") <= time) {
						nextCandidate = parts[i];
						depth++;
					} else if (i == 0) {
						return nextCandidate;
					} else {
						break;
					}
				}
			} else {
				return nextCandidate;
			}
		}
		return nextCandidate;
	}
	
	function updateParentDuration(parent, newDymo) {
		var parentTime = parent.getFeature("time");
		var newDymoTime = newDymo.getFeature("time");
		if (!parentTime || newDymoTime < parentTime) {
			setDymoFeature(parent, "time", newDymoTime);
		}
		var parentDuration = parent.getFeature("duration");
		var newDymoDuration = newDymo.getFeature("duration");
		if (!parentDuration || parentTime+parentDuration < newDymoTime+newDymoDuration) {
			setDymoFeature(parent, "duration", newDymoTime+newDymoDuration - parentTime);
		}
	}
	
	this.setDymoFeature = function(dymo, feature, value) {
		if (typeof feature === 'string' || feature instanceof String) {
			feature = getFeature(feature);
		}
		dymo.setFeature(feature.name, value);
		idToJson[dymo.getUri()][feature.name] = dymo.getFeatureJson(feature.name);
		updateMinMax(dymo, feature);
	}
	
	function getFeature(name) {
		//if already exists return that
		for (var i = 0; i < self.features.length; i++) {
			if (self.features[i].name == name) {
				return self.features[i];
			}
		}
		//if doesn't exist make a new one
		var newFeature = createFeature(name);
		self.features.splice(self.features.length-2, 0, newFeature);
		adjustViewConfig(newFeature);
		return newFeature;
	}
	
	function adjustViewConfig(newFeature) {
		if (self.features.length-2 == 1) {
			$scope.viewConfig.xAxis.param = newFeature;
		} else if (self.features.length-2 == 2) {
			$scope.viewConfig.yAxis.param = newFeature;
		} else if (self.features.length-2 == 3) {
			$scope.viewConfig.size.param = newFeature;
		} else if (self.features.length-2 == 4) {
			$scope.viewConfig.color.param = newFeature;
		}
	}
	
	//TODO REMOVE FROM HERE!!!
	function createFeature(name, min, max) {
		if (min != undefined && max != undefined) {
			return {name:name, min:min, max:max};
		}
		return {name:name, min:1000, max:0};
	}

}
