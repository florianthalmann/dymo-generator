import * as _ from 'lodash';
import { uris, URI_TO_TERM, DymoManager } from 'dymo-core';
import { SUMMARY } from './globals';
//import { Feature } from './types';

/**
 * Offers basic functions for generating dymos, inserts them into the given store.
 */
export class DymoGenerator {

	private manager: DymoManager;
	private ready: Promise<any>;
	private currentTopDymo; //the top dymo for the current audio file
	private currentRenderingUri;
	private summarizingMode = SUMMARY.MEAN;
	private currentSourcePath;
	private dymoCount = 0;
	private renderingCount = 0;

	constructor() {
		let context = typeof AudioContext !== 'undefined' ? new AudioContext() : null;
		this.manager = new DymoManager(context, null, false, null);
		this.ready = this.init();
	}

	private init(): Promise<any> {
		return new Promise(resolve => {
			this.manager.init()
			.then(r => {
				this.resetDymo();
				resolve();
			})
		});
	}

	isReady(): Promise<any> {
		return this.ready;
	}

	resetDymo() {
		this.currentTopDymo = undefined; //the top dymo for the current audio file
		//this.internalAddFeature("level", uris.LEVEL_FEATURE, 0, 0);
		//this.internalAddFeature("random", null, 0, 1);
	}

	getManager(): DymoManager {
		return this.manager;
	}

	addRendering() {
		this.currentRenderingUri = this.getUniqueRenderingUri();
		this.manager.getStore().addRendering(this.currentRenderingUri, this.currentTopDymo);
	}

	addMapping(ownerUri: string, mappingFunction, targetList, targetFunction, rangeUri: string) {
		this.manager.getStore().addMapping(ownerUri, mappingFunction, targetList, targetFunction, rangeUri);
	}

	addNavigator(navigatorType, subsetFunctionArgs, subsetFunctionBody) {
		this.manager.getStore().addNavigator(this.currentRenderingUri, navigatorType, subsetFunctionArgs, subsetFunctionBody);
	}

	getCurrentTopDymo() {
		return this.currentTopDymo;
	}

	setSummarizingMode(mode) {
		this.summarizingMode = mode;
	}

	setCurrentSourcePath(path) {
		this.currentSourcePath = path;
	}

	addDymo(parentUri, sourcePath?: string, dymoType?: string, dymoUri?: string) {
		if (!dymoUri) {
			dymoUri = this.getUniqueDymoUri();
		}
		this.manager.getStore().addDymo(dymoUri, parentUri, null, sourcePath, dymoType);
		if (!parentUri) {
			this.currentTopDymo = dymoUri;
		}
		return dymoUri;
	}

	private getUniqueDymoUri() {
		var dymoUri = uris.CONTEXT_URI + "dymo" + this.dymoCount;
		this.dymoCount++;
		return dymoUri;
	}

	private getUniqueRenderingUri() {
		var renderingUri = uris.CONTEXT_URI + "rendering" + this.renderingCount;
		this.renderingCount++;
		return renderingUri;
	}

	addFeature(name, data, dymoUri) {
		if (!dymoUri) {
			dymoUri = this.currentTopDymo;
		}
		//Benchmarker.startTask("addFeature")
		this.initTopDymoIfNecessary();
		//var feature = this.getFeature(name);
		//iterate through all levels and add averages
		var dymos = this.manager.getStore().findAllObjectsInHierarchy(dymoUri);
		for (var i = 0; i < dymos.length; i++) {
			var currentTime = this.manager.getStore().findFeatureValue(dymos[i], uris.TIME_FEATURE);
			var currentDuration = this.manager.getStore().findFeatureValue(dymos[i], uris.DURATION_FEATURE);
			var currentValues = data;
			if (!isNaN(currentTime)) {
				//only filter data id time given
				currentValues = currentValues.filter(
					x => currentTime <= x.time && (isNaN(currentDuration) || x.time < currentTime+currentDuration)
				);
			}
			//event-based feature:
			if (currentValues.length < 1) {
				var earlierValues = data.filter(x => x.time.value <= currentTime);
				if (earlierValues.length > 0) {
					currentValues = [earlierValues[currentValues.length-1]];
				} else {
					//set to first value
					currentValues = [data[0]];
				}
			}
			//Benchmarker.startTask("summarize")
			var value = this.getSummarizedValues(currentValues);
			/*if (typeof value == "string") {
				var labelFeature = getFeature(SEGMENT_LABEL);
				this.setDymoFeature(dymos[i], getFeature(SEGMENT_LABEL), value);
			}*/
			this.setDymoFeature(dymos[i], uris.CONTEXT_URI+name, value);
		}
	}

	//summarizes the given vectors into one based on summarizingMode
	private getSummarizedValues(vectors) {
		var vector = [];
		if (vectors && vectors.length > 0) {
			for (var i = 0; i < vectors.length; i++) {
				if (vectors[i].value && vectors[i].value.constructor !== Array) {
					//console.log(vectors[i].value)
					vectors[i].value = [vectors[i].value];
				}
			}
			var dim = vectors[0].value.length;
			for (var k = 0; k < dim; k++) {
				if (typeof vectors[0].value[k] == "string") {
					vector[k] = vectors[0].value[k];
				} else if (this.summarizingMode == SUMMARY.FIRST) {
					vector[k] = vectors[0].value[k];
				} else if (this.summarizingMode == SUMMARY.MEAN) {
					vector[k] = vectors.reduce((sum, i) => sum + i.value[k], 0) / vectors.length;
				} else if (this.summarizingMode == SUMMARY.MEDIAN) {
					vectors.sort((a, b) => a.value[k] - b.value[k]);
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

	addSegmentation(segments, dymoUri) {
		this.initTopDymoIfNecessary();
		var maxLevel = this.manager.getStore().findMaxLevel(this.currentTopDymo);
		for (var i = 0; i < segments.length; i++) {
			var parentUri = this.getSuitableParent(segments[i].time, maxLevel, dymoUri);
			var startTime = segments[i].time;
			var duration;
			if (segments[i].duration) {
				duration = segments[i].duration;
			} else if (segments[i+1]) {
				duration = segments[i+1].time - startTime;
			} else {
				var parentTime = this.manager.getStore().findFeatureValue(parentUri, uris.TIME_FEATURE);
				var parentDuration = this.manager.getStore().findFeatureValue(parentUri, uris.DURATION_FEATURE);
				if (parentTime && parentDuration) {
					duration = parentTime + parentDuration - startTime;
				}
			}
			//don't want anything with duration 0 (what other feature values would it have?)
			if (duration > 0) {
				var newDymoUri = this.addDymo(parentUri);
				this.setDymoFeature(newDymoUri, uris.TIME_FEATURE, startTime);
				this.setDymoFeature(newDymoUri, uris.DURATION_FEATURE, duration);
				/*if (segments[i].label && !isNaN(segments[i].label)) {
					this.setDymoFeature(newDymoUri, SEGMENT_LABEL_FEATURE, segments[i].label);
				}*/
				this.updateParentDuration(parentUri, newDymoUri);
			}
		}
	}

	private initTopDymoIfNecessary() {
		if (this.dymoCount == 0) {
			this.currentTopDymo = this.addDymo(null, this.currentSourcePath);
		}
	}

	private getSuitableParent(time, maxLevel, dymoUri) {
		if (!dymoUri) dymoUri = this.currentTopDymo;
		var nextCandidate = dymoUri;
		var currentLevel = this.manager.getStore().findLevel(dymoUri);
		while (currentLevel < maxLevel) {
			var parts = this.manager.getStore().findParts(nextCandidate);
			if (parts.length > 0) {
				parts = parts.map(p => [this.manager.getStore().findFeatureValue(p, uris.TIME_FEATURE), p]);
				parts.sort((p,q) => p[0]-q[0]);
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

	private updateParentDuration(parentUri, newDymoUri) {
		var parentTime = this.manager.getStore().findFeatureValue(parentUri, uris.TIME_FEATURE);
		var newDymoTime = this.manager.getStore().findFeatureValue(newDymoUri, uris.TIME_FEATURE);
		if (isNaN(parentTime) || Array.isArray(parentTime) || newDymoTime < parentTime) {
			this.setDymoFeature(parentUri, uris.TIME_FEATURE, newDymoTime);
			parentTime = newDymoTime;
		}
		var parentDuration = this.manager.getStore().findFeatureValue(parentUri, uris.DURATION_FEATURE);
		var newDymoDuration = this.manager.getStore().findFeatureValue(newDymoUri, uris.DURATION_FEATURE);
		if (isNaN(parentDuration) || Array.isArray(parentDuration) || parentTime+parentDuration < newDymoTime+newDymoDuration) {
			this.setDymoFeature(parentUri, uris.DURATION_FEATURE, newDymoTime+newDymoDuration - parentTime);
		}
	}

	setDymoFeature(dymoUri, featureUri, value) {
		this.manager.getStore().setFeature(dymoUri, featureUri, value);
		//this.updateMinMax(featureUri, value);
	}

	/*private updateMinMax(featureUri, value) {
		if (!isNaN(value)) {
			this.helpUpdateMinMax(this.getFeature(null, featureUri), value);
		} else if (value instanceof Array) {
			//it's an array
			for (var i = 0; i < value.length; i++) {
				this.helpUpdateMinMax(this.getFeature(null, featureUri), value[i]);
			}
		}
	}

	private helpUpdateMinMax(feature, value) {
		if (feature.max == undefined) {
			feature.min = value;
			feature.max = value;
		} else {
			feature.min = Math.min(value, feature.min);
			feature.max = Math.max(value, feature.max);
		}
	}

	private getFeature(name, uri?: string): Feature {
		let match = this.features.getValue().filter(f => f.name == name || f.uri == uri);
		return match.length > 0 ? match[0] : this.internalAddFeature(name, uri);
	}

	private internalAddFeature(name, uri, min?: number, max?: number): Feature {
		//complete attributes if necessary
		name = !name && uri ? URI_TO_TERM[uri] : name;
		uri = name && !uri ? uris.CONTEXT_URI+name : uri;
		min = min != null ? min : 1000;
		max = max != null ? max : 0;
		//create feature object and push
		let feature = {name:name, uri:uri, min:min, max:max};
		let features = _.clone(this.features.getValue());
		features.length < 2 ? features.push(feature) : features.splice(features.length-2, 0, feature);
		if (!this.manager.getStore().findObject(uri, uris.TYPE)) {
			this.manager.getStore().addTriple(uri, uris.TYPE, uris.FEATURE_TYPE);
		}
		this.features.next(features);
		return feature;
	}*/

}
