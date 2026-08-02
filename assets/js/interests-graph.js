document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("interest-graph");

  if (!container || typeof cytoscape === "undefined") {
    return;
  }

  let graphData;

  try {
    graphData = JSON.parse(container.dataset.elements);
  } catch (error) {
    console.error("Failed to parse interest graph data:", error);
    return;
  }

  /*
   * 최초 렌더링 시 random/cola 중간 상태가 보이지 않도록 숨깁니다.
   * Cola 배치와 fit이 모두 끝난 뒤 그래프를 표시합니다.
   */
  container.style.visibility = "hidden";

  const cy = cytoscape({
    container,

    elements: [...graphData.nodes, ...graphData.edges],

    minZoom: 0.35,
    maxZoom: 2.5,
    wheelSensitivity: 0.18,

    /*
     * Cytoscape 생성 시 임시 위치만 만듭니다.
     * fit은 Cola 레이아웃이 끝난 뒤 한 번만 수행합니다.
     */
    layout: {
      name: "random",
      fit: false,
    },

    style: [
      {
        selector: "node",
        style: {
          width: 16,
          height: 16,
          label: "",
          "background-color": "#6c757d",
          "border-width": 0,

          "font-size": 9,
          "font-weight": 400,
          "text-wrap": "wrap",
          "text-max-width": 100,
          "text-valign": "bottom",
          "text-halign": "center",
          "text-margin-y": 7,

          color: "#1f1f1f",
          "text-background-color": "#ffffff",
          "text-background-opacity": 0.9,
          "text-background-padding": 3,
          "text-background-shape": "roundrectangle",
        },
      },

      // 중심 노드
      {
        selector: "node.root-node",
        style: {
          width: 46,
          height: 46,
          label: "data(label)",
          "font-size": 13,
          "font-weight": 700,

          /*
           * 라이트 모드 기본값입니다.
           * 실제 테마별 색상은 applyTheme()에서 갱신합니다.
           */
          color: "#111827",

          "text-valign": "center",
          "text-margin-y": 0,
          "text-max-width": 70,
          "text-background-opacity": 0,
          "background-color": "#0879df",
          "border-width": 3,
          "border-color": "#ffffff",
        },
      },

      // 상위 카테고리 노드
      {
        selector: "node.category-node",
        style: {
          width: 24,
          height: 24,
          label: "data(label)",
          "font-size": 10,
          "font-weight": 600,
          "text-max-width": 125,
        },
      },

      // 세부 토픽은 기본적으로 라벨을 숨깁니다.
      {
        selector: "node.topic-node",
        style: {
          width: 14,
          height: 14,
          label: "",
        },
      },

      // Hover된 세부 토픽만 라벨을 표시합니다.
      {
        selector: "node.topic-node.hovered",
        style: {
          width: 19,
          height: 19,
          label: "data(label)",
          "font-size": 10,
          "font-weight": 600,
          "text-max-width": 135,
          "z-index": 999,
        },
      },

      // 선택된 세부 토픽도 라벨을 표시합니다.
      {
        selector: "node.topic-node:selected",
        style: {
          width: 21,
          height: 21,
          label: "data(label)",
          "font-size": 10,
          "font-weight": 600,
          "text-max-width": 135,
          "border-width": 3,
          "border-color": "#ffffff",
          "z-index": 1000,
        },
      },

      // 카테고리별 색상
      {
        selector: 'node[category = "ai"]',
        style: {
          "background-color": "#9c27b0",
        },
      },
      {
        selector: 'node[category = "network"]',
        style: {
          "background-color": "#009688",
        },
      },
      {
        selector: 'node[category = "aerospace"]',
        style: {
          "background-color": "#ff9100",
        },
      },
      {
        selector: 'node[category = "quantum"]',
        style: {
          "background-color": "#4054b2",
        },
      },
      {
        selector: 'node[category = "optimization"]',
        style: {
          "background-color": "#e91e63",
        },
      },

      {
        selector: "edge",
        style: {
          width: 1,
          opacity: 0.42,
          "curve-style": "bezier",
          "line-color": "#7a828a",
        },
      },

      {
        selector: "edge.highlighted",
        style: {
          width: 2.2,
          opacity: 0.95,
          "line-color": "#495057",
        },
      },

      {
        selector: ".faded",
        style: {
          opacity: 0.1,
        },
      },

      {
        selector: "node.highlighted",
        style: {
          opacity: 1,
          "border-width": 3,
          "border-color": "#ffffff",
          "z-index": 1000,
        },
      },
    ],
  });

  /*
   * YAML에서 icon이 있는 노드는 상위 카테고리로 처리합니다.
   * 나머지 노드는 세부 토픽으로 처리합니다.
   */
  cy.nodes().forEach((node) => {
    if (node.id() === "research-interests") {
      node.addClass("root-node");
    } else if (node.data("icon")) {
      node.addClass("category-node");
    } else {
      node.addClass("topic-node");
    }
  });

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const darkSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const prefersReducedMotion = reducedMotionQuery.matches;

  let physicsLayout;
  let stopTimer;

  /*
   * 이전 레이아웃의 stop 이벤트가 새로운 레이아웃의 viewport를
   * 변경하는 것을 방지하기 위한 실행 ID입니다.
   */
  let layoutRunId = 0;

  /*
   * 공통 Cola 레이아웃 옵션입니다.
   *
   * 최초 로딩과 Reset에서는 animate를 false로 덮어씁니다.
   * 사용자가 노드를 드래그할 때만 animate를 true로 사용합니다.
   */
  const physicsOptions = {
    name: "cola",
    animate: true,
    fit: false,
    padding: 45,

    avoidOverlap: true,
    handleDisconnected: true,

    // 라벨은 대부분 숨겨져 있으므로 충돌 계산에서 제외합니다.
    nodeDimensionsIncludeLabels: false,

    refresh: 1,
    convergenceThreshold: 0.01,

    // 물리 시뮬레이션 중 viewport가 자동으로 이동하지 않게 합니다.
    centerGraph: false,

    // 물리 시뮬레이션 중에도 노드를 드래그할 수 있게 합니다.
    ungrabifyWhileSimulating: false,

    nodeSpacing: (node) => {
      if (node.hasClass("root-node")) {
        return 24;
      }

      if (node.hasClass("category-node")) {
        return 16;
      }

      return 8;
    },

    edgeLength: (edge) => {
      const connectedNodes = edge.connectedNodes();

      if (connectedNodes.filter(".root-node").length > 0) {
        return 125;
      }

      if (connectedNodes.filter(".category-node").length > 0) {
        return 95;
      }

      return 70;
    },
  };

  /*
   * 현재 컨테이너 크기를 다시 계산한 뒤
   * 전체 그래프가 한 번에 보이도록 맞춥니다.
   */
  function fitGraph() {
    cy.resize();
    cy.fit(cy.elements(), 45);
  }

  /*
   * fit이 브라우저에 반영된 다음 그래프를 표시합니다.
   */
  function revealGraph() {
    requestAnimationFrame(() => {
      container.style.visibility = "visible";
    });
  }

  function runPhysics({
    infinite = false,
    maxSimulationTime = 1200,
    randomize = false,
    animate = true,
    fitOnStop = false,
    revealOnStop = false,
  } = {}) {
    /*
     * 실행 번호를 먼저 증가시켜 이전 레이아웃의 stop 콜백을
     * 무효화합니다.
     */
    const currentRunId = ++layoutRunId;

    physicsLayout?.stop();

    const shouldRunInfinitely = infinite && !prefersReducedMotion;

    const layoutOptions = {
      ...physicsOptions,

      animate: animate && !prefersReducedMotion,
      infinite: shouldRunInfinitely,
      randomize,

      stop: () => {
        /*
         * 이미 새로운 레이아웃이 실행된 경우,
         * 이전 레이아웃의 stop 콜백은 무시합니다.
         */
        if (currentRunId !== layoutRunId) {
          return;
        }

        if (fitOnStop) {
          fitGraph();
        }

        if (revealOnStop) {
          revealGraph();
        }
      },
    };

    /*
     * infinite 모드가 아닌 경우에만 실행 시간 제한을 설정합니다.
     */
    if (!shouldRunInfinitely) {
      layoutOptions.maxSimulationTime = maxSimulationTime;
    }

    physicsLayout = cy.layout(layoutOptions);
    physicsLayout.run();
  }

  /*
   * 최초 페이지 로딩:
   *
   * 그래프를 숨긴 상태에서 애니메이션 없이 Cola 배치를 완료합니다.
   * 이후 fit을 한 번 수행하고 최종 상태만 화면에 표시합니다.
   *
   * 따라서 기존처럼 확대된 상태에서 노드가 움직이다가
   * 마지막 순간에 zoom-out되는 현상이 나타나지 않습니다.
   */
  runPhysics({
    infinite: false,
    maxSimulationTime: 1200,
    randomize: false,
    animate: false,
    fitOnStop: true,
    revealOnStop: true,
  });

  /*
   * 노드를 잡으면 물리 엔진을 실행합니다.
   * 연결된 노드들이 용수철처럼 반응합니다.
   */
  cy.on("grab", "node", () => {
    window.clearTimeout(stopTimer);

    if (prefersReducedMotion) {
      return;
    }

    runPhysics({
      infinite: true,
      randomize: false,
      animate: true,
    });
  });

  /*
   * 노드를 놓은 후 700ms 동안 움직인 뒤 물리 엔진을 정지합니다.
   *
   * 이때 fit은 실행하지 않으므로 사용자가 보고 있던 zoom과
   * viewport는 바뀌지 않습니다.
   */
  cy.on("free", "node", () => {
    window.clearTimeout(stopTimer);

    stopTimer = window.setTimeout(() => {
      physicsLayout?.stop();
    }, 700);
  });

  /*
   * 세부 노드는 hover할 때만 라벨을 표시합니다.
   */
  cy.on("mouseover", "node.topic-node", (event) => {
    event.target.addClass("hovered");
  });

  cy.on("mouseout", "node.topic-node", (event) => {
    event.target.removeClass("hovered");
  });

  /*
   * 노드 선택 시 해당 노드와 주변 관계만 강조합니다.
   */
  const description = document.getElementById("interest-description");

  cy.on("tap", "node", (event) => {
    const node = event.target;
    const neighborhood = node.closedNeighborhood();

    cy.elements().unselect();
    node.select();

    cy.elements().removeClass("highlighted");
    cy.elements().addClass("faded");

    neighborhood.removeClass("faded");
    neighborhood.addClass("highlighted");

    if (description) {
      description.innerHTML = `
        <h3>${escapeHtml(node.data("label"))}</h3>
        <p>${escapeHtml(node.data("description") || "")}</p>
      `;
    }
  });

  /*
   * 빈 공간을 클릭하면 선택과 강조를 해제합니다.
   */
  cy.on("tap", (event) => {
    if (event.target !== cy) {
      return;
    }

    cy.elements().unselect();
    cy.elements().removeClass("faded highlighted");

    if (description) {
      description.textContent = "Select a node to view its description.";
    }
  });

  /*
   * al-folio CSS 변수 또는 그래프 전용 CSS 변수를 읽습니다.
   */
  function getCssVariable(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    return value || fallback;
  }

  /*
   * al-folio의 data-theme/class 상태를 우선 확인합니다.
   * 명시적인 테마 설정이 없으면 OS 테마를 사용합니다.
   */
  function isDarkTheme() {
    const html = document.documentElement;
    const body = document.body;

    const htmlTheme = (html.dataset.theme || "").toLowerCase();

    const bodyTheme = (body.dataset.theme || "").toLowerCase();

    if (htmlTheme === "dark" || bodyTheme === "dark") {
      return true;
    }

    if (htmlTheme === "light" || bodyTheme === "light") {
      return false;
    }

    if (html.classList.contains("dark") || body.classList.contains("dark")) {
      return true;
    }

    return darkSchemeQuery.matches;
  }

  /*
   * 현재 테마에 맞춰 노드 텍스트와 edge 색상을 갱신합니다.
   */
  function applyTheme() {
    const isDark = isDarkTheme();

    const textColor = getCssVariable("--global-text-color", isDark ? "#f1f3f5" : "#1f1f1f");

    const backgroundColor = getCssVariable("--global-bg-color", isDark ? "#1c1c1d" : "#ffffff");

    /*
     * --global-divider-color는 다크 모드에서 지나치게 어두울 수 있어
     * 그래프 전용 CSS 변수와 명시적인 대비값을 사용합니다.
     */
    const edgeColor = getCssVariable("--interest-graph-edge-color", isDark ? "#b8c0c8" : "#7a828a");

    const highlightedEdgeColor = getCssVariable("--interest-graph-highlighted-edge-color", isDark ? "#f1f3f5" : "#495057");

    /*
     * 중심 노드 텍스트:
     * 라이트 모드에서는 어두운 색,
     * 다크 모드에서는 흰색을 사용합니다.
     */
    const rootTextColor = getCssVariable("--interest-graph-root-text-color", isDark ? "#ffffff" : "#111827");

    cy.style()
      .selector("node")
      .style({
        color: textColor,
        "text-background-color": backgroundColor,
        "text-outline-color": backgroundColor,
      })
      .selector("node.root-node")
      .style({
        color: rootTextColor,
        "text-background-opacity": 0,
      })
      .selector("edge")
      .style({
        "line-color": edgeColor,
        opacity: isDark ? 0.62 : 0.42,
      })
      .selector("edge.highlighted")
      .style({
        "line-color": highlightedEdgeColor,
        opacity: 0.95,
      })
      .update();
  }

  applyTheme();

  /*
   * al-folio가 HTML 또는 body의 class/data-theme를 변경할 때
   * Cytoscape canvas의 색상도 갱신합니다.
   */
  const themeObserver = new MutationObserver(applyTheme);

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });

  themeObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });

  /*
   * 사이트가 명시적인 테마 속성을 사용하지 않는 경우를 위해
   * OS 색상 테마 변경도 감지합니다.
   */
  if (typeof darkSchemeQuery.addEventListener === "function") {
    darkSchemeQuery.addEventListener("change", applyTheme);
  } else {
    // 구형 Safari 호환
    darkSchemeQuery.addListener(applyTheme);
  }

  /*
   * 탭을 벗어나면 물리 연산과 예약된 정지를 중단합니다.
   * 탭으로 돌아왔을 때 자동으로 재실행하지는 않습니다.
   */
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      return;
    }

    window.clearTimeout(stopTimer);
    physicsLayout?.stop();
  });

  /*
   * Reset:
   *
   * 그래프를 숨기고 노드 위치를 무작위화한 뒤
   * 애니메이션 없이 다시 배치합니다.
   *
   * 배치가 끝나면 한 번만 fit하고 최종 상태를 표시합니다.
   */
  document.getElementById("interest-graph-reset")?.addEventListener("click", () => {
    window.clearTimeout(stopTimer);

    cy.elements().unselect();
    cy.elements().removeClass("faded highlighted");

    container.style.visibility = "hidden";

    runPhysics({
      infinite: false,
      maxSimulationTime: 1200,
      randomize: true,
      animate: false,
      fitOnStop: true,
      revealOnStop: true,
    });

    if (description) {
      description.textContent = "Select a node to view its description.";
    }
  });

  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
});
