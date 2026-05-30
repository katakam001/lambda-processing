const matchesEndMarker = (bankEndMarkers,bankName, decodedText) => {
  const markers = bankEndMarkers[bankName] || [];
  return markers.some((marker) => {
    return typeof marker === 'string'
      ? decodedText.trim().toLowerCase() === marker.toLowerCase()
      : marker.test(decodedText.trim());
  });
};

const matchesEndMarkerUsingFuzzyLogic = (bankEndMarkers,bankName, decodedText) => {
  const markers = bankEndMarkers[bankName] || [];
  const cleanedText = decodedText.trim().toLowerCase();

  return markers.some(marker => {
    if (typeof marker === 'string') {
      return cleanedText.includes(marker.toLowerCase());
    }
    return marker.test(decodedText);
  });
};
module.exports = { matchesEndMarker, matchesEndMarkerUsingFuzzyLogic };
