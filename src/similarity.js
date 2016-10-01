function Similarity() { }

//adds similarity relationships to the subdymos of the given dymo in the given store
Similarity.addSimilaritiesTo = function(dymoUri, store) {
	var currentLevel = [dymoUri];
	while (currentLevel.length > 0) {
		if (currentLevel.length > 1) {
			var vectorMap = Similarity.toVectors(currentLevel, store);
			var similarities = Similarity.getCosineSimilarities(vectorMap);
			//Similarity.addHighestSimilarities(store, similarities, currentLevel.length/2);
			Similarity.addSimilaritiesAbove(store, similarities, 0.4);
		}
		currentLevel = Similarity.getAllParts(currentLevel, store);
	}
}

//adds navigatable graph based on similarity relationships to the subdymos of the given dymo in the given store
Similarity.addSuccessionGraphTo = function(dymoUri, store) {
	var currentLevel = [dymoUri];
	while (currentLevel.length > 0) {
		if (currentLevel.length > 1) {
			//add sequential successions
			for (var i = 0; i < currentLevel.length-1; i++) {
				store.addSuccessor(currentLevel[i], currentLevel[i+1]);
			}
			//add successions based on similarity
			var vectorMap = Similarity.toVectors(currentLevel, store);
			var similarities = Similarity.getCosineSimilarities(vectorMap);
			var threshold = 0.4;
			for (var uri1 in similarities) {
				for (var uri2 in similarities[uri1]) {
					if (similarities[uri1][uri2] > threshold) {
						addSuccessorToPredecessorOf(uri1, uri2, currentLevel, store);
						addSuccessorToPredecessorOf(uri2, uri1, currentLevel, store);
					}
				}
			}
		}
		currentLevel = Similarity.getAllParts(currentLevel, store);
	}
}

//adds the given successor to the predecessor of the given uri in the given sequence
function addSuccessorToPredecessorOf(uri, successor, sequence, store) {
	var index = sequence.indexOf(uri);
	if (index > 0) {
		var predecessorUri = sequence[index-1];
		store.addSuccessor(predecessorUri, successor);
	}
}

Similarity.addSimilaritiesAbove = function(store, similarities, threshold) {
	for (var uri1 in similarities) {
		for (var uri2 in similarities[uri1]) {
			//console.log(similarities[uri1][uri2])
			if (similarities[uri1][uri2] > threshold) {
				store.addSimilar(uri1, uri2);
				store.addSimilar(uri2, uri1);
			}
		}
	}
}

Similarity.addHighestSimilarities = function(store, similarities, count) {
	//gather all similarities in an array
	var sortedSimilarities = [];
	for (var uri1 in similarities) {
		for (var uri2 in similarities[uri1]) {
			sortedSimilarities.push([similarities[uri1][uri2], uri1, uri2]);
		}
	}
	//sort in descending order
	sortedSimilarities = sortedSimilarities.sort(function(a,b){return b[0] - a[0]});
	console.log(sortedSimilarities.map(function(s){return s[0]}))
	//add highest ones to dymos
	for (var i = 0, l = Math.min(sortedSimilarities.length, count); i < l; i++) {
		var sim = sortedSimilarities[i];
		store.addSimilar(sim[1], sim[2]);
		store.addSimilar(sim[2], sim[1]);
	}
}

Similarity.getAllParts = function(dymoUris, store) {
	var parts = [];
	for (var i = 0, l = dymoUris.length; i < l; i++) {
		parts = parts.concat(store.findParts(dymoUris[i]));
	}
	return parts;
}

/**
 * returns a map with a vector for each given dymo. if reduce is true, multidimensional ones are reduced
 * @param {Boolean=} reduce (optional) */
Similarity.toVectors = function(dymoUris, store, reduce) {
	var vectors = [];
	for (var i = 0, l = dymoUris.length; i < l; i++) {
		var currentVector = [];
		var currentFeatures = store.findAllFeatureValues(dymoUris[i]).filter(function(v){return typeof v != "string";});;
		for (var j = 0, m = currentFeatures.length; j < m; j++) {
			var feature = currentFeatures[j];
			//reduce all multidimensional vectors to one value
			if (reduce && feature.length > 1) {
				feature = Similarity.reduce(feature);
			}
			if (feature.length > 1) {
				currentVector = currentVector.concat(feature);
			} else {
				feature = Number(feature);
				currentVector.push(feature);
			}
		}
		vectors[i] = currentVector;
	}
	//normalize the space
	var means = [];
	var vars = [];
	for (var i = 0; i < vectors[0].length; i++) {
		var currentDim = [];
		for (var j = 0; j < dymoUris.length; j++) {
			if (!isNaN(vectors[j][i])) {
				currentDim.push(vectors[j][i]);
			}
		}
		means[i] = math.mean(currentDim);
		vars[i] = math.var(currentDim);
	}
	vectors = vectors.map(function(v){return v.map(function(e,i){return (e-means[i])/vars[i];})});
	//pack vectors into map so they can be queried by uri
	var vectorsByUri = {};
	for (var i = 0; i < vectors.length; i++) {
		vectorsByUri[dymoUris[i]] = vectors[i];
	}
	return vectorsByUri;
}

Similarity.reduce = function(vector) {
	var unitVector = Array.apply(null, Array(vector.length)).map(Number.prototype.valueOf, 1);
	return Similarity.getCosineSimilarity(vector, unitVector);
}

Similarity.getCosineSimilarities = function(vectorMap) {
	var similarities = {};
	for (var uri1 in vectorMap) {
		for (var uri2 in vectorMap) {
			if (uri1 < uri2) {
				if (!similarities[uri1]) {
					similarities[uri1] = {};
				}
				similarities[uri1][uri2] = Similarity.getCosineSimilarity(vectorMap[uri1], vectorMap[uri2]);
			}
		}
	}
	return similarities;
}

Similarity.getCosineSimilarity = function(v1, v2) {
	if (v1.length == v2.length) {
		return math.dot(v1, v2)/(math.norm(v1)*math.norm(v2));
	}
	return 0;
}
