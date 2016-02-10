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
					if (similarities[uri1][uri2] > 0.994) {
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
	var maxes = [];
	//represent multidimensional ones with one value! cosine similarity with (1,1,...,1)?
	for (var i = 0, l = dymos.length; i < l; i++) {
		var currentVector = [];
		var currentFeatures = dymos[i].getFeatures();
		var keys = Object.keys(currentFeatures);
		for (var j = 0, m = keys.length; j < m; j++) {
			var feature = currentFeatures[keys[j]];
			if (feature.length > 1) {
				//feature = Similarity.reduce(feature);
			}
			if (!maxes[j]) {
				maxes[j] = feature;
			} else {
				maxes[j] = Math.max(feature, maxes[j]);
			}
			if (feature.length > 1) {
				Array.prototype.push.apply(currentVector, feature);
			} else {
				currentVector.push(feature);
			}
		}
		vectors[dymos[i].getUri()] = currentVector;
	}
	//normalize the space
	for (var i = 0, l = dymos.length; i < l; i++) {
		var currentVector = vectors[dymos[i].getUri()];
		for (var j = 0, m = currentVector.length; j < m; j++) {
			if (maxes[j]) {
				currentVector[j] /= maxes[j];
			}
		}
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
	return math.dot(v1, v2)/math.norm(v1)/math.norm(v2);
}
