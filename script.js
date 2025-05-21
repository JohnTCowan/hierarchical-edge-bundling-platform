document.addEventListener("DOMContentLoaded", function () {
  function id(node) {
    return (node.parent ? id(node.parent) + "." : "") + node.data.name;
  }

  function bilink(root) {
    const map = new Map(root.leaves().map(d => [id(d), d]));
    for (const d of root.leaves()) {
      d.incoming = [];
      d.outgoing = (d.data.imports_with_type || []).map(i => [d, map.get(i.target), i.type]).filter(([, t]) => t);
    }
    for (const d of root.leaves()) {
      for (const [source, target, type] of d.outgoing) {
        if (target) target.incoming.push([source, type]);
      }
    }
    return root;
  }

  const width = 800;
  const radius = width / 2;

  const relationshipTypes = ["Member Of", "Contributes To", "Depends On", "Reviews"];
  const relationshipColor = d3.scaleOrdinal()
    .domain(relationshipTypes)
    .range(d3.schemeCategory10);

  const svg = d3.select("body")
    .append("svg")
    .attr("width", width)
    .attr("height", width)
    .attr("viewBox", [-radius, -radius, width, width])
    .attr("style", "font-family: 'Poppins', sans-serif; font-size: 10px;");

  d3.json("hierarchical_edge_bundling_clean.json").then(data => {
    const root = d3.cluster()
      .size([2 * Math.PI, radius - 100])
      (bilink(d3.hierarchy(data)));

    const line = d3.lineRadial()
      .curve(d3.curveBundle.beta(0.85))
      .radius(d => d.y)
      .angle(d => d.x);

    const links = root.leaves().flatMap(source =>
      source.outgoing.map(([src, target, type]) => ({
        source: src,
        target,
        type
      }))
    );

    const g = svg.append("g");

    const edgePaths = g.append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("d", d => line(d.source.path(d.target)))
      .attr("stroke", d => relationshipColor(d.type))
      .attr("stroke-width", 3.5)
      .attr("stroke-opacity", 0.75);

    const labelGroup = g.append("g");
    let lockedNodes = new Set();

    const labels = labelGroup.selectAll("text")
      .data(root.leaves())
      .join("text")
      .attr("dy", "0.31em")
      .attr("transform", d => `
        rotate(${d.x * 180 / Math.PI - 90})
        translate(${d.y + 8},0)
        ${d.x >= Math.PI ? "rotate(180)" : ""}
      `)
      .attr("text-anchor", d => d.x < Math.PI ? "start" : "end")
      .attr("class", "label")
      .style("cursor", "pointer")
      .text(d => d.data.name)
      .on("click", function (event, d) {
        const nodeId = id(d);
        if (lockedNodes.has(nodeId)) {
          lockedNodes.delete(nodeId);
        } else {
          lockedNodes.add(nodeId);
        }
        updateHighlight();
        event.stopPropagation();
      });

    svg.on("click", () => {
      lockedNodes.clear();
      updateHighlight();
    });

    function updateHighlight() {
      if (lockedNodes.size === 0) {
        edgePaths.attr("stroke-opacity", 0.75);
        labels.style("font-weight", "normal");
        return;
      }

      edgePaths.attr("stroke-opacity", l =>
        lockedNodes.has(id(l.source)) || lockedNodes.has(id(l.target)) ? 1 : 0.05);
      labels.style("font-weight", d =>
        lockedNodes.has(id(d)) ? "bold" : "normal");
    }

    const legend = svg.append("g").attr("transform", `translate(${-radius + 20},${-radius + 20})`);
    legend.append("text").text("Connection Type").attr("font-weight", "bold");
    relationshipTypes.forEach((rel, i) => {
      legend.append("circle")
        .attr("cx", 0).attr("cy", 15 + i * 16).attr("r", 6).attr("fill", relationshipColor(rel));
      legend.append("text")
        .attr("x", 10).attr("y", 15 + i * 16 + 3)
        .text(rel);
    });
  });
});