/* One WebP probe for the whole page. CSS then swaps the fixed backdrop
   and the street-bar panorama to WebP, which is a third the weight.
   Both are decorative background-images, so <picture> is not available
   to them the way it is to the hero. */
(function () {
  var probe = new Image();
  probe.onload = function () {
    if (probe.width > 0) document.documentElement.classList.add('webp');
  };
  probe.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
})();
