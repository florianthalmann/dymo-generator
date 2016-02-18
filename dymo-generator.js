function DymoGenerator(scheduler, onFeatureAdded) {
	
	var self = this;
	
	var topDymo;
	var currentTopDymo; //the top dymo for the current audio file
	var audioFileChanged;
	var dymoGraph;
	var similarityGraph;
	var idToDymo;
	var idToJson;
	var features;
	var maxDepth;
	var condensationMode = MEAN;
	var currentSourcePath;
	
	this.resetDymo = function() {
		topDymo = undefined;
		currentTopDymo = undefined; //the top dymo for the current audio file
		audioFileChanged = false;
		dymoGraph = {"nodes":[], "links":[]};
		similarityGraph = {"nodes":[], "links":[]};
		idToDymo = {};
		idToJson = {};
		features = [createFeature("level"), createFeature("random", 0, 1)];
		maxDepth = 0;
	}
	
	this.setDymo = function(dymo, dymoMap) {
		this.resetDymo();
		recursiveAddDymo(undefined, dymo);
	}
	
	this.getDymo = function() {
		return topDymo;
	}
	
	this.getDymoGraph = function() {
		return dymoGraph;
	}
	
	this.getSimilarityGraph = function() {
		return similarityGraph;
	}
	
	this.getFeatures = function() {
		return features;
	}
	
	function recursiveAddDymo(parent, currentDymo) {
		var newDymo = self.addDymo(parent);
		var features = currentDymo.getFeatures();
		for (var name in features) {
			self.setDymoFeature(newDymo, getFeature(name), features[name]);
		}
		self.setDymoFeature(newDymo, getFeature("level"), currentDymo.getLevel());
		var parts = currentDymo.getParts();
		for (var i = 0; i < parts.length; i++) {
			recursiveAddDymo(newDymo, parts[i]);
		}
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
		if (topDymo) {
			var newDymo = new DynamicMusicObject("dymo" + getDymoCount(), scheduler, PARALLEL);
			newDymo.addPart(topDymo);
			topDymo = newDymo;
			updateGraphAndMap(topDymo);
		}
	}
	
	this.addDymo = function(parent, sourcePath) {
		var uri;
		if (parent) {
			uri = parent.getUri();
		}
		var newDymo = new DynamicMusicObject("dymo" + getDymoCount(), scheduler);
		if (!topDymo) {
			topDymo = newDymo;
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
		dymoGraph = topDymo.toJsonHierarchyGraph();
		similarityGraph = topDymo.toJsonSimilarityGraph();
		if (dymo) {
			var flatJson = dymo.toFlatJson();
			idToDymo[dymo.getUri()] = dymo;
			idToJson[dymo.getUri()] = flatJson;
			for (var i = 0; i < features.length; i++) {
				updateMinMax(dymo, features[i]);
			}
		}
	}
	
	function updateMinMax(dymo, feature) {
		var value = dymo.getFeature(feature.name);
		if (!isNaN(value)) {
			helpUpdateMinMax(feature, value);
		} else if (value instanceof Array) {
			//it's an array
			for (var i = 0; i < value.length; i++) {
				helpUpdateMinMax(feature, value[i]);
			}
		}
	}
	
	function helpUpdateMinMax(feature, value) {
		if (feature.max == undefined) {
			feature.min = value;
			feature.max = value;
		} else {
			feature.min = Math.min(value, feature.min);
			feature.max = Math.max(value, feature.max);
		}
	}
	
	function getDymoCount() {
		return Object.keys(idToDymo).length;
	}
	
	this.addFeature = function(name, data, dimensions) {
		//iterate through all levels and add averages
		var feature = getFeature(name);
		for (var i = 0; i < dymoGraph.nodes.length; i++) {
			var currentTime = dymoGraph.nodes[i]["time"].value;
			var currentDuration = dymoGraph.nodes[i]["duration"].value;
			var currentValues = data.filter(
				function(x){return currentTime <= x.time.value && x.time.value < currentTime+currentDuration}
			);
			//event-based feature:
			if (currentValues.length < 1) {
				currentValues = data.filter(
					function(x){return x.time.value < currentTime}
				);
				currentValues = currentValues[currentValues.length-1];
			}
			var value = getCondensedValues(currentValues);
			this.setDymoFeature(this.getRealDymo(dymoGraph.nodes[i]), feature, value);
		}
		updateGraphAndMap();
	}
	
	//condenses the given vectors into one based on condensationMode
	function getCondensedValues(vectors) {
		var vector = [];
		if (vectors.length > 0) {
			var dim = vectors[0].value.length;
			for (var k = 0; k < dim; k++) {
				if (condensationMode == FIRST) {
					vector[k] = vectors[0].value[k];
				} else if (condensationMode == MEAN) {
					vector[k] = vectors.reduce(function(sum, i) { return sum + i.value[k]; }, 0) / vectors.length;
				} else if (condensationMode == MEDIAN) {
					vectors.sort(function(a, b) { return a.value[k] - b.value[k]; });
					var middleIndex = Math.floor(values.length/2);
					vector[k] = vectors[middleIndex].value[k];
					if (vectors.length % 2 == 0) {
						vector[k] += vectors[middleIndex-1].value[k];
					}
				}
			}
			if (vector.length == 1) {
				return vector[0];
			}
			return vector;
		}
		return 0;
	}
	
	this.addSegmentation = function(segments) {
		if (getDymoCount() == 0) {
			currentTopDymo = this.addDymo(undefined, currentSourcePath);
		} else if (audioFileChanged) {
			currentTopDymo = this.addDymo(topDymo, currentSourcePath);
			maxDepth = currentTopDymo.getLevel();
			audioFileChanged = false;
		}
		for (var i = 0; i < segments.length; i++) {
			parent = getSuitableParent(segments[i].time.value);
			var startTime = segments[i].time.value;
			var duration;
			if (segments[i].duration) {
				duration = segments[i].duration.value;
			} else if (segments[i+1]) {
				duration = segments[i+1].time.value - startTime;
			} else if (parent.getFeature("time") && parent.getFeature("duration")) {
				duration = parent.getFeature("time") + parent.getFeature("duration") - startTime;
			}
			//don't want anything with duration 0 (what other feature values would it have?)
			if (duration > 0) {
				var newDymo = this.addDymo(parent);
				this.setDymoFeature(newDymo, "time", startTime);
				this.setDymoFeature(newDymo, "duration", duration);
				if (segments[i].label && !isNaN(segments[i].label)) {
					this.setDymoFeature(newDymo, "segmentLabel", segments[i].label.value);
				}
				updateParentDuration(parent, newDymo);
			}
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
						//depth++;
					} else if (i == 0) {
						nextCandidate = parts[i];
					} else {
						break;
					}
				}
				depth++;
			} else {
				return nextCandidate;
			}
		}
		return nextCandidate;
	}
	
	function updateParentDuration(parent, newDymo) {
		var parentTime = parent.getFeature("time");
		var newDymoTime = newDymo.getFeature("time");
		if (isNaN(parentTime) || Array.isArray(parentTime) || newDymoTime < parentTime) {
			self.setDymoFeature(parent, "time", newDymoTime);
		}
		var parentDuration = parent.getFeature("duration");
		var newDymoDuration = newDymo.getFeature("duration");
		if (isNaN(parentDuration) || Array.isArray(parentDuration) || parentTime+parentDuration < newDymoTime+newDymoDuration) {
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
		for (var i = 0; i < features.length; i++) {
			if (features[i].name == name) {
				return features[i];
			}
		}
		//if doesn't exist make a new one
		var newFeature = createFeature(name);
		features.splice(features.length-2, 0, newFeature);
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
