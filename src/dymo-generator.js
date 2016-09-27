/**
 * Offers basic functions for generating dymos, inserts them into the given store. The updateGraph function needs to be called manually.
 * @constructor
 */
function DymoGenerator(store, onFeatureAdded, onGraphsChanged) {
	
	var self = this;
	
	var topDymo; //TODO REMOVE
	var currentTopDymo; //the top dymo for the current audio file
	var audioFileChanged;
	var dymoGraph;
	var similarityGraph;
	var features;
	var summarizingMode = SUMMARY.MEAN;
	var currentSourcePath;
	var dymoCount = 0;
	
	this.resetDymo = function() {
		topDymo = undefined;
		currentTopDymo = undefined; //the top dymo for the current audio file
		audioFileChanged = false;
		dymoGraph = {"nodes":[], "links":[]};
		similarityGraph = {"nodes":[], "links":[]};
		features = [];
		addFeature("level", LEVEL_FEATURE)
		addFeature("random", null, 0, 1);
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
		var newDymo = internalAddDymo(parent);
		var features = currentDymo.getFeatures();
		for (var name in features) {
			self.setDymoFeature(newDymo, name, features[name]);
		}
		self.setDymoFeature(newDymo, LEVEL_FEATURE, currentDymo.getLevel());
		var parts = currentDymo.getParts();
		for (var i = 0; i < parts.length; i++) {
			recursiveAddDymo(newDymo, parts[i]);
		}
	}
	
	this.setSummarizingMode = function(mode) {
		summarizingMode = mode;
	}
	
	this.setCurrentSourcePath = function(path) {
		currentSourcePath = path;
	}
	
	this.setAudioFileChanged = function() {
		audioFileChanged = true;
		if (currentTopDymo) {
			var dymoUri = getUniqueDymoUri();
			store.addDymo(dymoUri, null, currentTopDymo);
			currentTopDymo = dymoUri;
		}
	}
	
	this.addDymo = function(parentUri, sourcePath) {
		var dymoUri = internalAddDymo(parentUri, sourcePath);
		return dymoUri;
	}
	
	function internalAddDymo(parentUri, sourcePath) {
		var dymoUri = getUniqueDymoUri();
		store.addDymo(dymoUri, parentUri, null, sourcePath);
		if (!parentUri) {
			currentTopDymo = dymoUri;
		}
		return dymoUri;
	}
	
	function getUniqueDymoUri() {
		var dymoUri = CONTEXT_URI + "dymo" + dymoCount;
		dymoCount++;
		return dymoUri;
	}
	
	this.updateGraphs = function() {
		Benchmarker.startTask("toPartGraph")
		store.toJsonGraph(DYMO, HAS_PART, function(pg) {
			dymoGraph = pg;
			Benchmarker.startTask("toSimilarGraph")
			store.toJsonGraph(DYMO, HAS_SIMILAR, function(sg) {
				similarityGraph = sg;
				if (onGraphsChanged) {
					onGraphsChanged();
				}
			});
		});
	}
	
	this.addFeature = function(name, data, dimensions) {
		Benchmarker.startTask("addFeature")
		initTopDymoIfNecessary();
		var feature = getFeature(name);
		//iterate through all levels and add averages
		var dymos = store.findAllObjectsInHierarchy(currentTopDymo);
		for (var i = 0; i < dymos.length; i++) {
			var currentTime = store.findFeature(dymos[i], TIME_FEATURE);
			var currentDuration = store.findFeature(dymos[i], DURATION_FEATURE);
			var currentValues = data;
			if (!isNaN(currentTime)) {
				//only filter data id time given
				currentValues = currentValues.filter(
					function(x){return currentTime <= x.time && (isNaN(currentDuration) || x.time < currentTime+currentDuration);}
				);
			}
			//event-based feature:
			if (currentValues.length < 1) {
				currentValues = data.filter(
					function(x){return x.time.value < currentTime}
				);
				currentValues = currentValues[currentValues.length-1];
			}
			Benchmarker.startTask("summarize")
			var value = getSummarizedValues(currentValues);
			//console.log(value)
			this.setDymoFeature(dymos[i], feature.uri, value);
		}
	}
	
	//summarizes the given vectors into one based on summarizingMode
	function getSummarizedValues(vectors) {
		var vector = [];
		if (vectors && vectors.length > 0) {
			for (var i = 0; i < vectors.length; i++) {
				if (vectors[i].value.constructor !== Array) {
					//console.log(vectors[i].value)
					vectors[i].value = [vectors[i].value];
				}
			}
			var dim = vectors[0].value.length;
			for (var k = 0; k < dim; k++) {
				if (summarizingMode == SUMMARY.FIRST) {
					vector[k] = vectors[0].value[k];
				} else if (summarizingMode == SUMMARY.MEAN) {
					vector[k] = vectors.reduce(function(sum, i) { return sum + i.value[k]; }, 0) / vectors.length;
				} else if (summarizingMode == SUMMARY.MEDIAN) {
					vectors.sort(function(a, b) { return a.value[k] - b.value[k]; });
					var middleIndex = Math.floor(vectors.length/2);
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
		initTopDymoIfNecessary();
		var maxLevel = store.getMaxLevel();
		for (var i = 0; i < segments.length; i++) {
			var parentUri = getSuitableParent(segments[i].time, maxLevel);
			var startTime = segments[i].time;
			var duration;
			if (segments[i].duration) {
				duration = segments[i].duration;
			} else if (segments[i+1]) {
				duration = segments[i+1].time - startTime;
			} else {
				var parentTime = store.findFeature(parentUri, TIME_FEATURE);
				var parentDuration = store.findFeature(parentUri, DURATION_FEATURE);
				if (parentTime && parentDuration) {
					duration = parentTime + parentDuration - startTime;
				}
			}
			//don't want anything with duration 0 (what other feature values would it have?)
			if (duration > 0) {
				var newDymo = internalAddDymo(parentUri);
				this.setDymoFeature(newDymo, TIME_FEATURE, startTime);
				this.setDymoFeature(newDymo, DURATION_FEATURE, duration);
				if (segments[i].label && !isNaN(segments[i].label)) {
					this.setDymoFeature(newDymo, SEGMENT_LABEL_FEATURE, segments[i].label);
				}
				updateParentDuration(parentUri, newDymo);
			}
		}
	}
	
	function initTopDymoIfNecessary() {
		if (dymoCount == 0) {
			currentTopDymo = internalAddDymo(undefined, currentSourcePath);
		} else if (audioFileChanged) {
			currentTopDymo = internalAddDymo(topDymo, currentSourcePath);
			audioFileChanged = false;
		}
	}
	
	function getSuitableParent(time, maxLevel) {
		var nextCandidate = currentTopDymo;
		var currentLevel = store.getLevel(currentTopDymo);
		while (currentLevel < maxLevel) {
			var parts = store.findParts(nextCandidate);
			if (parts.length > 0) {
				parts = parts.map(function(p){return [store.findFeature(p, TIME_FEATURE), p]});
				parts.sort(function(p,q){return p[0]-q[0];});
				for (var i = 0; i < parts.length; i++) {
					if (parts[i][0] <= time) {
						nextCandidate = parts[i][1];
					} else if (i == 0) {
						nextCandidate = parts[i][1];
					} else {
						break;
					}
				}
				currentLevel++;
			} else {
				return nextCandidate;
			}
		}
		return nextCandidate;
	}
	
	function updateParentDuration(parentUri, newDymoUri) {
		var parentTime = store.findFeature(parentUri, TIME_FEATURE);
		var newDymoTime = store.findFeature(newDymoUri, TIME_FEATURE);
		if (isNaN(parentTime) || Array.isArray(parentTime) || newDymoTime < parentTime) {
			self.setDymoFeature(parentUri, TIME_FEATURE, newDymoTime);
		}
		var parentDuration = store.findFeature(parentUri, DURATION_FEATURE);
		var newDymoDuration = store.findFeature(newDymoUri, DURATION_FEATURE);
		if (isNaN(parentDuration) || Array.isArray(parentDuration) || parentTime+parentDuration < newDymoTime+newDymoDuration) {
			self.setDymoFeature(parentUri, DURATION_FEATURE, newDymoTime+newDymoDuration - parentTime);
		}
	}
	
	this.setDymoFeature = function(dymoUri, featureUri, value) {
		store.setFeature(dymoUri, featureUri, value);
		updateMinMax(featureUri, value);
	}
	
	function updateMinMax(featureUri, value) {
		if (!isNaN(value)) {
			helpUpdateMinMax(getFeature(null, featureUri), value);
		} else if (value instanceof Array) {
			//it's an array
			for (var i = 0; i < value.length; i++) {
				helpUpdateMinMax(getFeature(null, featureUri), value[i]);
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
	
	function getFeature(name, uri) {
		//if already exists return that
		for (var i = 0; i < features.length; i++) {
			if (features[i].name == name) {
				return features[i];
			}
			if (features[i].uri == uri) {
				return features[i];
			}
		}
		return addFeature(name, uri);
	}
	
	function addFeature(name, uri, min, max) {
		//complete name and uri if necessary
		if (!name && uri) {
			name = URI_TO_TERM[uri];
		}
		if (name && !uri) {
			uri = CONTEXT_URI+name;
		}
		//create feature object
		var feature;
		if (min != undefined && max != undefined) {
			feature = {name:name, uri:uri, min:min, max:max};
		} else {
			feature = {name:name, uri:uri, min:1000, max:0};
		}
		//put in features list
		if (features.length < 2) {
			features.push(feature);
		} else {
			features.splice(features.length-2, 0, feature);
		}
		onFeatureAdded(feature);
		return feature;
	}
	
	//INIT!!
	this.resetDymo();

}
