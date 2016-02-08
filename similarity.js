function Similarity() { }

Similarity.addSimilaritiesTo = function(dymo) {
	var dymoMap = dymo.getDymoMap();
	var currentLevel = [dymo];
	while (currentLevel.length > 0) {
		if (currentLevel.length > 1) {
			var vectorMap = Similarity.toVectors(currentLevel);
			var similarities = Similarity.getCosineSimilarities(vectorMap);
			for (var uri1 in similarities) {
				for (var uri2 in similarities[uri1]) {
					if (similarities[uri1][uri2] > 0.8) {
						dymoMap[uri1].addSimilar(dymoMap[uri2]);
						dymoMap[uri2].addSimilar(dymoMap[uri1]);
					}
				}
			}
		}
		currentLevel = Similarity.getAllParts(currentLevel);
	}
}

Similarity.getAllParts = function(dymos) {
	var parts = [];
	for (var i = 0, l = dymos.length; i < l; i++) {
		Array.prototype.push.apply(parts, dymos[i].getParts());
	}
	return parts;
}

Similarity.toVectors = function(dymos) {
	var vectors = {};
	//represent multidimensional ones with one value! cosine similarity with (1,1,...,1)?
	for (var i = 0, l = dymos.length; i < l; i++) {
		var currentVector = [];
		var currentFeatures = dymo.getFeatures();
		for (var featureName in dymo.getFeatures()) {
			var feature = currentFeatures[featureName];
			if (feature.length > 0) {
				feature = Similarity.reduce(feature);
			}
			currentVector.push(feature);
		}
		vectors[dymos[i].getUri()] = currentVector;
	}
	return vectors;
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
				similarities[uri1][uri2] = Similarity.getCosineSimilarity(vectorMap[uri1], vectorMap[uri2]);
			}
		}
	}
	return similarities;
}

Similarity.getCosineSimilarity = function(v1, v2) {
	return math.dot(v1, v2)/math.norm(v1)/math.norm(v2);
}
