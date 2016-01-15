function DymoGenerator(scheduler, onFeatureAdded) {
	
	var self = this;
	
	this.dymo;
	var currentTopDymo; //the top dymo for the current audio file
	var audioFileChanged;
	this.dymoGraph;
	this.similarityGraph;
	var idToDymo;
	var idToJson;
	this.features;
	var maxDepth;
	var condensationMode = MEAN;
	var currentSourcePath;
	
	this.resetDymo = function() {
		this.dymo = undefined;
		currentTopDymo = undefined; //the top dymo for the current audio file
		audioFileChanged = false;
		this.dymoGraph = {"nodes":[], "links":[]};
		this.similarityGraph = {"nodes":[], "links":[]};
		idToDymo = {};
		idToJson = {};
		this.features = [createFeature("level"), createFeature("random", 0, 1)];
		maxDepth = 0;
	}
	
	this.setCondensationMode = function(mode) {
		condensationMode = mode;
	}
	
	this.setCurrentSourcePath = function(path) {
		currentSourcePath = path;
	}
	
	this.getScheduler = function() {
		return scheduler;
	}
	
	this.getRealDymo = function(dymo) {
		return idToDymo[dymo["@id"]];
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
			var value = getCondensedValues(currentValues);
			this.setDymoFeature(this.getRealDymo(this.dymoGraph.nodes[i]), feature, value);
		}
		updateGraphAndMap();
	}
	
	//condenses the given values into one value based on condensationMode
	function getCondensedValues(values) {
		var value = 0;
		if (condensationMode == FIRST) {
			value = values[0].value[0];
		} else if (condensationMode == MEAN) {
			value = values.reduce(function(sum, i) { return sum + i.value[0]; }, 0) / values.length;
		} else if (condensationMode == MEDIAN) {
			values.sort(function(a, b) { return a.value[0] - b.value[0]; });
			var middleIndex = Math.floor(values.length/2);
			value = values[middleIndex].value[0];
			if (values.length % 2 == 0) {
				value += values[middleIndex-1].value[0];
			}
		}
		return value;
	}
	
	this.addSegmentation = function(segments) {
		if (getDymoCount() == 0) {
			currentTopDymo = this.addDymo(undefined, currentSourcePath);
		} else if (audioFileChanged) {
			currentTopDymo = this.addDymo(self.dymo, currentSourcePath);
			maxDepth = currentTopDymo.getLevel();
			audioFileChanged = false;
		}
		for (var i = 0; i < segments.length-1; i++) {
			parent = getSuitableParent(segments[i].time.value);
			var newDymo = this.addDymo(parent);
			var startTime = segments[i].time.value;
			this.setDymoFeature(newDymo, "time", startTime);
			this.setDymoFeature(newDymo, "duration", segments[i+1].time.value - startTime);
			if (segments[i].label) {
				this.setDymoFeature(newDymo, "segmentLabel", segments[i].label.value);
			}
			updateParentDuration(parent, newDymo);
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
			self.setDymoFeature(parent, "time", newDymoTime);
		}
		var parentDuration = parent.getFeature("duration");
		var newDymoDuration = newDymo.getFeature("duration");
		if (!parentDuration || parentTime+parentDuration < newDymoTime+newDymoDuration) {
			self.setDymoFeature(parent, "duration", newDymoTime+newDymoDuration - parentTime);
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
		onFeatureAdded(newFeature);
		return newFeature;
	}
	
	//TODO REMOVE FROM HERE!!!
	function createFeature(name, min, max) {
		if (min != undefined && max != undefined) {
			return {name:name, min:min, max:max};
		}
		return {name:name, min:1000, max:0};
	}
	
	//INIT!!
	this.resetDymo();

}
