---
layout: page
title: interests
permalink: /interests/
description: An interactive graph of my research interests.
nav: true
nav_order: 4
---

<div class="interest-graph-header">
  <p>
    Drag nodes, zoom, and select an interest to explore related research topics.
  </p>

<button id="interest-graph-reset" type="button">Reset View</button>

</div>

<div
  id="interest-graph"
  data-elements='{{ site.data.interests_graph | jsonify }}'
></div>

<div id="interest-description">
  Select a node to view its description.
</div>

<script src="https://cdn.jsdelivr.net/npm/cytoscape/dist/cytoscape.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/webcola@3.4.0/WebCola/cola.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/cytoscape-cola@2.1.0/cytoscape-cola.js"></script>
<script src="{{ '/assets/js/interests-graph.js' | relative_url }}"></script>