import * as math from 'mathjs'
import * as _ from 'lodash'
import { uris } from 'dymo-core'
import { StructureInducer, IterativeSmithWatermanResult, Similarity, Quantizer, SmithWaterman } from 'siafun'

export module DymoStructureInducer {

  export function flattenStructure(dymoUri, store) {
    let leaves = recursiveFlatten(dymoUri, store);
    store.setParts(dymoUri, leaves);
  }

  function recursiveFlatten(dymoUri: string, store, parentUri?: string) {
    let parts = getAllParts([dymoUri], store);
    if (parts.length > 0) {
      if (parentUri) {
        store.removeDymo(dymoUri);
      }
      return _.uniq(_.flatten(parts.map(p => recursiveFlatten(p, store, dymoUri))));
    } else {
      return dymoUri;
    }
  }

  //adds a hierarchical structure to the subdymos of the given dymo in the given store
  export function addStructureToDymo(dymoUri, store, options) {
    var surfaceDymos = getAllParts([dymoUri], store);
    var points = toVectors(surfaceDymos, store, false, true);
    var occurrences = new StructureInducer(points, options).getOccurrences(options.patternIndices);
    createStructure(occurrences, store, dymoUri, surfaceDymos);
  }

  function createStructure(occurrences: number[][][], store, dymoUri, surfaceDymos) {
    var patternDymos = [];
    for (var i = 0; i < occurrences.length; i++) {
      var currentPatternDymo = store.addDymo((uris.CONTEXT_URI+"pattern"+i), dymoUri);
      patternDymos.push(currentPatternDymo);
      var dymoUris = occurrences[i].map(occ => occ.map(index => surfaceDymos[index]));
      var features = store.findAllObjects(dymoUris[0][0], uris.HAS_FEATURE).map(f => store.findObject(f, uris.TYPE));
      var occDymos = [];
      for (var j = 0; j < dymoUris.length; j++) {
        var currentOccDymo = store.addDymo((uris.CONTEXT_URI+"occurrence"+i)+j, currentPatternDymo);
        occDymos.push(currentOccDymo);
        //console.log(dymoUris[j], occurrences[j])
        dymoUris[j].forEach(d => store.addPart(currentOccDymo, d));
        updateAverageFeatures(currentOccDymo, dymoUris[j], features, store);
      }
      updateAverageFeatures(currentPatternDymo, occDymos, features, store);
    }
    store.setParts(dymoUri, patternDymos);
    var freeSurfaceDymos = _.intersection(store.findTopDymos(), surfaceDymos);
    freeSurfaceDymos.forEach(d => store.addPart(dymoUri, d));
  }

  export function addStructureToDymo2(dymoUri, store, options) {
    var surfaceDymos = getAllParts([dymoUri], store);
    var points = toVectors(surfaceDymos, store, false, true);
    var structure = new StructureInducer(points, options).getStructure();

    store.removeParts(dymoUri);
    var features = store.findAllObjects(surfaceDymos[0], uris.HAS_FEATURE).map(f => store.findObject(f, uris.TYPE));
    recursiveCreateDymoStructure(structure, [], dymoUri, surfaceDymos, features, store);
  }

  export function testSmithWaterman(dymoUri, store, options): IterativeSmithWatermanResult {
    //this.flattenStructure(dymoUri, store);
    var surfaceDymos = getAllParts([dymoUri], store);
    var points = toVectors(surfaceDymos, store, false, true);
    //TODO ADD SORTING DIM TO OPTIONS!!!
    let zipped = _.zip(surfaceDymos, points);
    zipped.sort((a,b) => a[1][2]-b[1][2]);
    [surfaceDymos, points] = _.unzip(zipped);
    //console.log(JSON.stringify(new StructureInducer(points, options).getSmithWaterman()));
    let result = new StructureInducer(points, options).getSmithWatermanOccurrences(options);
    createStructure(result.segments, store, dymoUri, surfaceDymos);
    return result;
  }

  export function compareSmithWaterman(uri1, uri2, store, options) {
    var points1 = quant(uri1, options, store).map(p => p.slice(0,3));
    var points2 = quant(uri2, options, store).map(p => p.slice(0,3));
    new SmithWaterman(options.similarityThreshold).run(points1, points2);
  }

  function quant(uri, options, store) {
    let points = toVectors(getAllParts([uri], store), store, false, true);
    let quantizerFuncs = options ? options.quantizerFunctions : [];
    let quantizer = new Quantizer(quantizerFuncs);
    return quantizer.getQuantizedPoints(points);
  }

  function recursiveCreateDymoStructure(structure, currentPath, currentParentUri, leafDymos, features, store) {
    for (let i = 0; i < structure.length; i++) {
      if (typeof structure[i] === 'number') {
        let leafDymo = leafDymos[structure[i]];
        store.addPart(currentParentUri, leafDymo);
      } else {
        let currentSubPath = currentPath.concat(i);
        let segmentUri = store.addDymo((uris.CONTEXT_URI+"segment"+currentSubPath.join('.')), currentParentUri);
        recursiveCreateDymoStructure(structure[i], currentSubPath, segmentUri, leafDymos, features, store);
        //after the recursion call, the children are there
        let children = store.findParts(segmentUri);
        updateAverageFeatures(segmentUri, children, features, store);
      }
    }
  }

  function updateAverageFeatures(parent, children, features, store) {
    var avgFeatureVals = children.map(d => features.map(f => store.findFeatureValue(d, f)));
    //remove multidimensional features
    features = features.filter((f,i) => avgFeatureVals[0][i] != null && avgFeatureVals[0][i].constructor !== Array);
    avgFeatureVals = avgFeatureVals.map(vs => vs.filter(v => v != null && v.constructor !== Array));
    avgFeatureVals = math.mean(avgFeatureVals, 0);
    //console.log(avgFeatureVals);
    avgFeatureVals.forEach((v,k) => store.setFeature(parent, features[k], v));
  }

  //adds similarity relationships to the subdymos of the given dymo in the given store
	export function addSimilaritiesTo(dymoUri, store, threshold) {
		var currentLevel = [dymoUri];
		while (currentLevel.length > 0) {
			if (currentLevel.length > 1) {
				var vectorMap = toNormVectors(currentLevel, store);
				var similarities = this.getCosineSimilarities(vectorMap);
				//this.addHighestSimilarities(store, similarities, currentLevel.length/2);
				this.addSimilaritiesAbove(store, similarities, threshold);
			}
			currentLevel = this.getAllParts(currentLevel, store);
		}
	}

	//adds navigatable graph based on similarity relationships to the subdymos of the given dymo in the given store
	export function addSuccessionGraphTo(dymoUri, store, threshold) {
		var currentLevel = [dymoUri];
		while (currentLevel.length > 0) {
			if (currentLevel.length > 1) {
				//add sequential successions
				for (var i = 0; i < currentLevel.length-1; i++) {
					store.addSuccessor(currentLevel[i], currentLevel[i+1]);
				}
				//add successions based on similarity
				var vectorMap = this.toNormVectors(currentLevel, store);
				var similarities = this.getCosineSimilarities(vectorMap);
				for (var uri1 in similarities) {
					for (var uri2 in similarities[uri1]) {
						if (similarities[uri1][uri2] > threshold) {
							Similarity.addSuccessorToPredecessorOf(uri1, uri2, currentLevel, store);
							Similarity.addSuccessorToPredecessorOf(uri2, uri1, currentLevel, store);
						}
					}
				}
			}
			currentLevel = this.getAllParts(currentLevel, store);
		}
	}

  export function getAllParts(dymoUris, store) {
		var parts = [];
		for (var i = 0, l = dymoUris.length; i < l; i++) {
			parts = parts.concat(store.findParts(dymoUris[i]));
		}
		return parts;
	}

  /**
	 * returns a map with a normalized vector for each given dymo. if reduce is true, multidimensional ones are reduced
	 */
	export function toNormVectors(dymoUris, store, reduce?: boolean) {
		var vectors = toVectors(dymoUris, store, reduce);
    vectors = new Quantizer(null).normalize(vectors);
		//pack vectors into map so they can be queried by uri
		var vectorsByUri = {};
		for (var i = 0; i < vectors.length; i++) {
			vectorsByUri[dymoUris[i]] = vectors[i];
		}
		return vectorsByUri;
	}

  /**
	 * returns a map with a vector for each given dymo. if reduce is true, multidimensional ones are reduced
	 */
	export function toVectors(dymoUris, store, reduce?: boolean, noFlatten?: boolean): number[][] {
		var vectors = [];
		for (var i = 0, l = dymoUris.length; i < l; i++) {
			var currentVector = [];
			var currentFeatures = store.findAllFeatureValues(dymoUris[i]).filter(v => typeof v != "string");
			for (var j = 0, m = currentFeatures.length; j < m; j++) {
				var feature = currentFeatures[j];
				//reduce all multidimensional vectors to one value
				if (reduce && feature.length > 1) {
					feature = this.reduce(feature);
				}
				if (feature.length > 1) {
					if (noFlatten) {
						currentVector.push(feature);
					} else {
						currentVector = currentVector.concat(feature);
					}
				} else {
					feature = Number(feature);
					currentVector.push(feature);
				}
			}
			vectors[i] = currentVector;
		}
		return vectors;
	}

  //TODO ADD TO QUANTIZER? or other tool i guess.. its against float errors
  function getRoundedSum(a, b) {
    return _.zipWith(a, b, (a,b) => _.round(a+b), 1);
    //a.map((ai,i) => _.round(ai + b[i]), 1);
    //_.zipWith(a, b, _.flow([_.add, _.round.curryRight(1)]);
  }

}