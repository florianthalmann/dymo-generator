/**
 * @constructor
 */
function DymoGenerator(store, onFeatureAdded, onGraphsChanged) {
	
	var self = this;
	
	var topDymo; //TODO REMOVE
	var topDymoUri;
	var currentTopDymo; //the top dymo for the current audio file
	var audioFileChanged;
	var dymoGraph;
	var similarityGraph;
	var features;
	var maxDepth;
	var condensationMode = MEAN;
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
		maxDepth = 0;
	}
	
	this.setDymo = function(dymo, dymoMap) {
		this.resetDymo();
		recursiveAddDymo(undefined, dymo);
		updateGraphAndMap();
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
	
	this.setCondensationMode = function(mode) {
		condensationMode = mode;
	}
	
	this.setCurrentSourcePath = function(path) {
		currentSourcePath = path;
	}
	
	this.setAudioFileChanged = function() {
		audioFileChanged = true;
		if (topDymoUri) {
			var dymoUri = getUniqueDymoUri();
			store.addDymo(dymoUri, null, topDymoUri);
			topDymoUri = dymoUri;
			updateGraphAndMap();
		}
	}
	
	this.addDymo = function(parentUri, sourcePath) {
		var dymoUri = internalAddDymo();
		updateGraphAndMap();
		return dymoUri;
	}
	
	function internalAddDymo(parentUri, sourcePath) {
		var dymoUri = getUniqueDymoUri();
		store.addDymo(dymoUri, parentUri, null, sourcePath);
		if (!topDymoUri) {
			topDymoUri = dymoUri;
		}
		return dymoUri;
	}
	
	function getUniqueDymoUri() {
		var dymoUri = CONTEXT_URI + "dymo" + dymoCount;
		dymoCount++;
		return dymoUri;
	}
	
	function updateGraphAndMap() {
		store.toJsonGraph(DYMO, HAS_PART, function(pg) {
			dymoGraph = pg;
			store.toJsonGraph(DYMO, HAS_SIMILAR, function(sg) {
				similarityGraph = sg;
				if (onGraphsChanged) {
					onGraphsChanged();
				}
			});
		});
	}
	
	this.addFeature = function(name, data, dimensions) {
		var feature = addFeature(name);
		//iterate through all levels and add averages
		var dymos = store.findAllSubjectUris(TYPE, DYMO);
		for (var i = 0; i < dymos.length; i++) {
			var currentTime = store.findFeature(dymos[i], TIME_FEATURE);
			var currentDuration = store.findFeature(dymos[i], DURATION_FEATURE);
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
			this.setDymoFeature(dymos[i], feature.uri, value);
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
		if (dymoCount == 0) {
			currentTopDymo = internalAddDymo(undefined, currentSourcePath);
		} else if (audioFileChanged) {
			currentTopDymo = internalAddDymo(topDymo, currentSourcePath);
			maxDepth = currentTopDymo.getLevel();
			audioFileChanged = false;
		}
		for (var i = 0; i < segments.length; i++) {
			var parentUri = getSuitableParent(segments[i].time.value);
			var startTime = segments[i].time.value;
			var duration;
			if (segments[i].duration) {
				duration = segments[i].duration.value;
			} else if (segments[i+1]) {
				duration = segments[i+1].time.value - startTime;
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
					this.setDymoFeature(newDymo, SEGMENT_LABEL_FEATURE, segments[i].label.value);
				}
				updateParentDuration(parentUri, newDymo);
			}
		}
		updateGraphAndMap();
		maxDepth++;
	}
	
	function getSuitableParent(time) {
		var nextCandidate = currentTopDymo;
		var depth = store.getLevel(currentTopDymo);
		while (depth < maxDepth) {
			var parts = store.findParts(nextCandidate);
			if (parts.length > 0) {
				parts = parts.map(function(p){return [store.findFeature(p, TIME_FEATURE), p]});
				parts.sort(function(p,q){return p[0]-q[0];});
				for (var i = 0; i < parts.length; i++) {
					if (parts[i][0] <= time) {
						nextCandidate = parts[i][1];
						//depth++;
					} else if (i == 0) {
						nextCandidate = parts[i][1];
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
	
	this.setDymoFeature = function(dymoUri, feature, value) {
		store.setFeature(dymoUri, feature, value);
		updateMinMax(feature, value);
	}
	
	function updateMinMax(featureUri, value) {
		if (!isNaN(value)) {
			helpUpdateMinMax(getFeature(featureUri), value);
		} else if (value instanceof Array) {
			//it's an array
			for (var i = 0; i < value.length; i++) {
				helpUpdateMinMax(getFeature(featureUri), value[i]);
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
	
	function getFeature(uri) {
		//if already exists return that
		for (var i = 0; i < features.length; i++) {
			if (features[i].uri == uri) {
				return features[i];
			}
		}
		return addFeature(null, uri);
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
