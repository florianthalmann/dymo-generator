function Similarity() { }

Similarity.addSimilaritiesTo = function(dymoUri, store) {
	var currentLevel = [dymoUri];
	while (currentLevel.length > 0) {
		if (currentLevel.length > 1) {
			var vectorMap = Similarity.toVectors(currentLevel, store);
			var similarities = Similarity.getCosineSimilarities(vectorMap);
			//Similarity.addHighestSimilarities(store, similarities, currentLevel.length/2);
			Similarity.addSimilaritiesAbove(store, similarities, 0.8);
		}
		currentLevel = Similarity.getAllParts(currentLevel, store);
	}
}

Similarity.addSimilaritiesAbove = function(store, similarities, threshold) {
	for (var uri1 in similarities) {
		for (var uri2 in similarities[uri1]) {
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
		var currentFeatures = store.findAllFeatureValues(dymoUris[i]);
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
