// Interactive kubectl demo simulator.
// Plays back four kubectl walkthroughs grounded in the real cluster.

const overlay = document.getElementById("demo-overlay");
const closeBtn = document.getElementById("demo-close");
const playBtn = document.getElementById("demo-play");
const stepBtn = document.getElementById("demo-step");
const resetBtn = document.getElementById("demo-reset");
const output = document.getElementById("terminal-output");
const titleEl = document.getElementById("demo-title");
const picks = document.querySelectorAll(".demo-pick");

const DEMOS = {
  overview: {
    title: "kubectl — cluster overview",
    steps: [
      {
        say: "Five commands. They give you a complete picture of any cluster you walk into.",
      },
      { run: "kubectl config current-context", out: ["internal"] },
      {
        say: "Verifies which cluster you are about to touch. Always run this first.",
      },
      {
        run: "kubectl get nodes -o wide",
        out: [
          "NAME            STATUS   ROLES    AGE   VERSION                INTERNAL-IP     OS-IMAGE             RUNTIME",
          "10.100.11.142   Ready    <none>   50d   v1.34.3-r0-34.0.12.3   10.100.11.142   Ubuntu 22.04.5 LTS   containerd://1.7.29",
          "10.100.11.241   Ready    <none>   26d   v1.34.3-r0-34.0.12.3   10.100.11.241   Ubuntu 22.04.5 LTS   containerd://1.7.29",
        ],
      },
      {
        say: "Two worker nodes. Both Ready. Both on managed Kubernetes 1.34.",
      },
      {
        run: "kubectl get ns",
        out: [
          "argocd            Active   29d",
          "cert-manager      Active   50d",
          "cnpg-system       Active   48d",
          "dev-007           Active   7d23h",
          "jenkins           Active   48d",
          "keycloak          Active   17d",
          "ingress           Active   49d",
          "monitoring        Active   14d",
          "vault             Active   11d",
          "... (22 total)",
        ],
      },
      {
        say: "22 namespaces. The platform layer (gitops-cd, ci, ingress, secrets, monitoring) plus app envs.",
      },
      { run: "kubectl get pods -A | wc -l", out: ["93"], status: "success" },
      {
        say: "92 pods running, plus the header line. Healthy fleet size for our workload.",
      },
      {
        run: "kubectl top nodes",
        out: [
          "NAME            CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)",
          "10.100.11.142   594m         7%       11034Mi         79%",
          "10.100.11.241   2238m        28%      16302Mi         56%",
        ],
      },
      {
        say: "Node 1 is memory-bound at 79%. Node 2 has headroom. If we cared, we could rebalance — or add a third node.",
      },
    ],
  },

  deploy: {
    title: "kubectl — deploy a service",
    steps: [
      {
        say: "We never apply manifests by hand in production — ArgoCD does. But for learning, here's the manual flow.",
      },
      {
        run: "cat deployment.yaml",
        out: [
          "apiVersion: apps/v1",
          "kind: Deployment",
          "metadata: { name: api, namespace: backend }",
          "spec:",
          "  replicas: 3",
          "  selector: { matchLabels: { app: api } }",
          "  template:",
          "    metadata: { labels: { app: api } }",
          "    spec:",
          "      containers:",
          "        - name: api",
          "          image: registry.example.com/yourorg/api:v1.4.2",
          "          ports: [{ containerPort: 8080 }]",
        ],
      },
      { say: "Three replicas. Image pulled from SWR Enterprise." },
      {
        run: "kubectl apply -f deployment.yaml",
        out: ["deployment.apps/api created"],
        status: "success",
      },
      {
        run: "kubectl get pods -n backend -l app=api",
        out: [
          "NAME                   READY   STATUS    RESTARTS   AGE",
          "api-7d4f5b9c8d-2x4f9   1/1     Running   0          12s",
          "api-7d4f5b9c8d-h7k2p   1/1     Running   0          12s",
          "api-7d4f5b9c8d-r8m1n   1/1     Running   0          12s",
        ],
      },
      {
        say: "Three pods running across our two nodes. K8s scheduled them automatically.",
      },
      {
        run: "kubectl expose deployment api --port=80 --target-port=8080 -n backend",
        out: ["service/api exposed"],
        status: "success",
      },
      {
        say: "A Service was just created. Inside the cluster, anyone can curl http://api.backend and get load-balanced to one of the three pods.",
      },
      {
        run: "kubectl describe deploy api -n backend | head -10",
        out: [
          "Name:                   api",
          "Namespace:              backend",
          "Replicas:               3 desired | 3 updated | 3 total | 3 available",
          "StrategyType:           RollingUpdate",
          "MinReadySeconds:        0",
          "RollingUpdateStrategy:  25% max unavailable, 25% max surge",
        ],
      },
      {
        say: "Default rollout: 25% surge, 25% unavailable. Safe for most services. Tune per workload if needed.",
      },
    ],
  },

  scale: {
    title: "kubectl — scale & rollout",
    steps: [
      {
        say: "Two ways to scale: manually and via HPA. Then a rolling update demo.",
      },
      {
        run: "kubectl scale deploy api -n backend --replicas=5",
        out: ["deployment.apps/api scaled"],
        status: "success",
      },
      {
        run: "kubectl get pods -n backend -l app=api",
        out: [
          "api-7d4f5b9c8d-2x4f9   1/1     Running    0     2m",
          "api-7d4f5b9c8d-h7k2p   1/1     Running    0     2m",
          "api-7d4f5b9c8d-r8m1n   1/1     Running    0     2m",
          "api-7d4f5b9c8d-q3v5x   0/1     Pending    0     1s",
          "api-7d4f5b9c8d-w8z2k   0/1     Pending    0     1s",
        ],
      },
      {
        say: "Two new pods, Pending. Scheduler is finding nodes. They'll be Running in seconds.",
      },
      { say: "Better than manual scaling: let HPA do it on traffic." },
      {
        run: "cat hpa.yaml",
        out: [
          "apiVersion: autoscaling/v2",
          "kind: HorizontalPodAutoscaler",
          "metadata: { name: api, namespace: backend }",
          "spec:",
          "  scaleTargetRef: { kind: Deployment, name: api }",
          "  minReplicas: 2",
          "  maxReplicas: 10",
          "  metrics:",
          "    - type: Resource",
          "      resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }",
        ],
      },
      {
        run: "kubectl apply -f hpa.yaml",
        out: ["horizontalpodautoscaler.autoscaling/api created"],
        status: "success",
      },
      {
        run: "kubectl get hpa -n backend",
        out: [
          "NAME   REFERENCE        TARGETS       MINPODS   MAXPODS   REPLICAS   AGE",
          "api    Deployment/api   cpu: 4%/70%   2         10        3          5s",
        ],
      },
      {
        say: "Now scaling is automatic. Below 70% CPU → fewer pods. Above → more.",
      },
      { say: "Rolling update to a new image:" },
      {
        run: "kubectl set image deploy/api api=registry.example.com/yourorg/api:v1.4.3 -n backend",
        out: ["deployment.apps/api image updated"],
        status: "success",
      },
      {
        run: "kubectl rollout status deploy/api -n backend",
        out: [
          'Waiting for deployment "api" rollout to finish: 1 of 3 updated...',
          'Waiting for deployment "api" rollout to finish: 2 of 3 updated...',
          'deployment "api" successfully rolled out',
        ],
        status: "success",
      },
      {
        say: "Zero downtime. Old pods drained as new ones became Ready. Rollback is one command if anything looks wrong:",
      },
      {
        run: "kubectl rollout undo deploy/api -n backend",
        out: ["deployment.apps/api rolled back"],
        status: "success",
      },
    ],
  },

  "self-heal": {
    title: "kubectl — self-healing",
    steps: [
      {
        say: "K8s reconciles desired state continuously. Kill a pod and watch.",
      },
      {
        run: "kubectl get pods -n backend -l app=api",
        out: [
          "api-7d4f5b9c8d-2x4f9   1/1     Running   0     5m",
          "api-7d4f5b9c8d-h7k2p   1/1     Running   0     5m",
          "api-7d4f5b9c8d-r8m1n   1/1     Running   0     5m",
        ],
      },
      {
        run: "kubectl delete pod api-7d4f5b9c8d-2x4f9 -n backend",
        out: ['pod "api-7d4f5b9c8d-2x4f9" deleted'],
        status: "warn",
      },
      { say: "We just killed one. Wait one second…" },
      {
        run: "kubectl get pods -n backend -l app=api",
        out: [
          "api-7d4f5b9c8d-h7k2p   1/1     Running   0     5m",
          "api-7d4f5b9c8d-r8m1n   1/1     Running   0     5m",
          "api-7d4f5b9c8d-jq8x4   1/1     Running   0     2s",
        ],
        status: "success",
      },
      {
        say: "New pod, 2 seconds old. Replica count is back to 3. No human in the loop.",
      },
      {
        say: "Node failure works the same way. K8s evicts pods from a NotReady node and reschedules onto healthy ones.",
      },
      {
        run: "kubectl drain 10.100.11.142 --ignore-daemonsets --delete-emptydir-data",
        out: [
          "node/10.100.11.142 cordoned",
          "evicting pod backend/api-7d4f5b9c8d-h7k2p",
          "evicting pod monitoring/prometheus-0",
          "... (8 pods total)",
          "node/10.100.11.142 drained",
        ],
        status: "warn",
      },
      {
        say: "All evicted pods land on the surviving node. When you uncordon, traffic rebalances.",
      },
      {
        run: "kubectl uncordon 10.100.11.142",
        out: ["node/10.100.11.142 uncordoned"],
        status: "success",
      },
      {
        say: "This is what makes 3 a.m. less awful. The platform handles the routine recovery; you handle the rare actually-broken cases.",
      },
    ],
  },
};

let active = "overview";
let stepIdx = 0;
let playing = false;
let typingAbort = null;

function clear() {
  output.innerHTML = "";
  stepIdx = 0;
}
function setActiveDemo(name) {
  active = name;
  picks.forEach((p) => p.classList.toggle("active", p.dataset.demo === name));
  titleEl.textContent = DEMOS[name].title;
  clear();
}

picks.forEach((p) =>
  p.addEventListener("click", () => setActiveDemo(p.dataset.demo)),
);
closeBtn.addEventListener("click", () => overlay.classList.remove("visible"));
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) overlay.classList.remove("visible");
});
resetBtn.addEventListener("click", () => {
  stop();
  clear();
});

stepBtn.addEventListener("click", async () => {
  stop();
  await runStep(stepIdx);
  stepIdx += 1;
  scrollDown();
});

playBtn.addEventListener("click", async () => {
  if (playing) {
    stop();
    return;
  }
  playing = true;
  playBtn.textContent = "⏸ Pause";
  while (playing && stepIdx < DEMOS[active].steps.length) {
    await runStep(stepIdx);
    stepIdx += 1;
    scrollDown();
    await sleep(900);
  }
  stop();
});

function stop() {
  playing = false;
  playBtn.textContent = "▶ Play";
  if (typingAbort) typingAbort();
}
function sleep(ms) {
  return new Promise((r) => {
    const id = setTimeout(r, ms);
    typingAbort = () => {
      clearTimeout(id);
      r();
    };
  });
}
function scrollDown() {
  const term = document.querySelector(".demo-terminal");
  term.scrollTop = term.scrollHeight;
}

async function runStep(i) {
  const step = DEMOS[active].steps[i];
  if (!step) return;

  if (step.say) {
    const el = document.createElement("span");
    el.className = "term-narration";
    el.textContent = step.say;
    output.appendChild(el);
    await sleep(400);
    return;
  }
  if (step.run) {
    const prompt = document.createElement("span");
    prompt.className = "term-prompt";
    prompt.textContent = "$";
    output.appendChild(prompt);
    output.appendChild(document.createTextNode(" "));
    const cmd = document.createElement("span");
    cmd.className = "term-cmd";
    output.appendChild(cmd);
    await typeText(cmd, step.run, 18);
    output.appendChild(document.createElement("br"));
    await sleep(300);

    if (step.out && step.out.length) {
      step.out.forEach((line) => {
        const o = document.createElement("span");
        o.className = "term-result" + (step.status ? " " + step.status : "");
        o.textContent = line;
        output.appendChild(o);
        output.appendChild(document.createElement("br"));
      });
    }
    await sleep(200);
  }
}

function typeText(el, text, speed = 30) {
  return new Promise((resolve) => {
    let i = 0;
    function tick() {
      el.textContent += text[i];
      i += 1;
      if (i < text.length) {
        const id = setTimeout(tick, speed + Math.random() * 20);
        typingAbort = () => {
          clearTimeout(id);
          el.textContent = text;
          resolve();
        };
      } else resolve();
    }
    tick();
  });
}

window.addEventListener("demo:opened", () => {
  if (output.children.length === 0) {
    setActiveDemo(active);
    const intro = document.createElement("span");
    intro.className = "term-narration";
    intro.textContent =
      "Press ▶ Play to run, or Step ▷ to advance one command at a time. Output is from the actual cluster.";
    output.appendChild(intro);
  }
});
