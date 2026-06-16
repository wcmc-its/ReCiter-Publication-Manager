/**
 * View 4 — Deployment & CI/CD topology.
 * Git push → CodePipeline → CodeBuild (Docker → ECR) → kubectl set image on EKS.
 *
 * Source: k8-buildspec.yml (pipeline, S3 certs, Secrets Manager, ECR, kubectl),
 * Dockerfile (node:18-alpine multi-stage), kubernetes/k8-deployment.yaml,
 * kubernetes/k8-service.yaml, kubernetes/k8-secrets.yaml, README.md.
 */
import { A } from "../lib.mjs";

const nodes = {
  // CI/CD pipeline (top)
  gh:        { x: 40,  y: 96,  w: 185, h: 78, kind: "ext", title: "GitHub repo",
               sub: ["wcmc-its/…-Manager"], chip: { tone: "ondemand", text: "push" } },
  pipeline:  { x: 270, y: 96,  w: 215, h: 78, kind: "aws", title: "AWS CodePipeline",
               sub: ["Source · ManualApproval", "· Build"] },
  build:     { x: 535, y: 96,  w: 210, h: 92, kind: "aws", title: "CodeBuild",
               sub: ["Docker multi-stage", "node:18-alpine"] },
  ecr:       { x: 795, y: 96,  w: 175, h: 78, kind: "aws", title: "Amazon ECR",
               sub: ["container image :TAG"] },
  s3:        { x: 40,  y: 212, w: 200, h: 58, kind: "data", title: "S3 reciter-config",
               sub: ["SAML idp / sp certs"] },
  secretsmgr:{ x: 260, y: 212, w: 215, h: 58, kind: "aws", title: "Secrets Manager",
               sub: ["docker-hub-credentials"] },

  // Inbound users (outside the cluster)
  users: { x: 40, y: 470, w: 170, h: 80, kind: "ext", title: "Users", sub: ["browser (HTTPS)"] },

  // EKS cluster
  alb:   { x: 270, y: 440, w: 160, h: 80, kind: "edge", title: "ALB Ingress", sub: ["healthcheck /login", "200–302"] },
  svc:   { x: 470, y: 440, w: 150, h: 80, kind: "net",  title: "Service", sub: ["NodePort 80→3000"] },
  deploy:{ x: 660, y: 418, w: 200, h: 100, kind: "app", title: "Deployment",
           sub: ["reciter-pm-prod", "reciter-pm-dev", "Ec2Spot · rolling"] },
  pod:   { x: 910, y: 430, w: 200, h: 92, kind: "app", title: "Pod · container :3000",
           sub: ["Next.js start", "hc /api/healthcheck"] },
  hpa:   { x: 660, y: 566, w: 200, h: 72, kind: "net", title: "HPA · 1–3 replicas", sub: ["CPU 80% / mem 85%"] },
  k8secrets: { x: 910, y: 566, w: 200, h: 72, kind: "aws", title: "reciter-pm-secrets",
               sub: ["DB · SAML · SMTP", "· NEXTAUTH"] },

  // External back-ends (outside the cluster)
  reciterdb: { x: 1180, y: 430, w: 170, h: 80, kind: "data", title: "ReCiterDB · MySQL", sub: ["reporting store"] },
  reciter:   { x: 1180, y: 540, w: 170, h: 80, kind: "app",  title: "ReCiter / PubMed", sub: ["REST back-ends"] },
};

const groups = [
  { x: 24, y: 70, w: 960, h: 220, kind: "aws", title: "CI/CD pipeline (us-east-1)" },
  { x: 240, y: 330, w: 900, h: 360, kind: "net", title: "Amazon EKS · namespace: reciter" },
];

const S = "straight";
const edges = [
  // pipeline
  { p0: A(nodes.gh, "r"), p1: A(nodes.pipeline, "l"), route: S, color: "gray", label: "git push" },
  { p0: A(nodes.pipeline, "r"), p1: A(nodes.build, "l"), route: S, color: "gray", label: "approved" },
  { p0: A(nodes.build, "r"), p1: A(nodes.ecr, "l"), route: S, color: "violet", label: "push image" },
  { p0: A(nodes.s3, "t", 0.4), p1: A(nodes.build, "l", 0.9), color: "gray", dash: true,
    points: [{ x: 120, y: 202 }, { x: 512, y: 202 }], lp: { x: 380, y: 202 }, label: "SAML certs" },
  { p0: A(nodes.secretsmgr, "t", 0.6), p1: A(nodes.build, "l", 0.6), color: "gray", dash: true,
    points: [{ x: 389, y: 188 }, { x: 512, y: 188 }], lp: { x: 452, y: 188 }, label: "docker creds" },
  // pipeline → cluster
  { p0: A(nodes.build, "b", 0.6), p1: A(nodes.deploy, "t", 0.3), color: "violet", label: "kubectl set image" },
  { p0: A(nodes.ecr, "b", 0.5), p1: A(nodes.pod, "t", 0.4), color: "violet", dash: true, label: "pull image" },
  // cluster request path
  { p0: A(nodes.users, "r"), p1: A(nodes.alb, "l", 0.5), route: S, color: "maroon", label: "HTTPS" },
  { p0: A(nodes.alb, "r"), p1: A(nodes.svc, "l"), route: S, color: "indigo", label: "route" },
  { p0: A(nodes.svc, "r"), p1: A(nodes.deploy, "l", 0.5), route: S, color: "indigo", label: "selects pods" },
  { p0: A(nodes.deploy, "r"), p1: A(nodes.pod, "l", 0.5), route: S, color: "green", label: "creates" },
  // cluster control
  { p0: A(nodes.hpa, "t", 0.5), p1: A(nodes.deploy, "b", 0.5), color: "gray", dash: true, label: "scales" },
  { p0: A(nodes.k8secrets, "t", 0.5), p1: A(nodes.pod, "b", 0.5), color: "gray", dash: true, label: "env (secretKeyRef)" },
  // pod → back-ends
  { p0: A(nodes.pod, "r", 0.3), p1: A(nodes.reciterdb, "l", 0.5), route: S, color: "amber", label: "Sequelize" },
  { p0: A(nodes.pod, "r", 0.75), p1: A(nodes.reciter, "l", 0.4), color: "teal", label: "REST" },
];

export const spec = { id: "deployment", vb: [1380, 740], groups, nodes, edges };

export const meta = {
  nav: "④ Deploy",
  kicker: "View 4 · deployment & CI/CD",
  heading: "From git push to running pods on EKS",
  dot: "#7048e8",
  blurb:
    "A push to a <code>master</code> or <code>*dev</code> branch drives <b>CodePipeline</b> " +
    "(Source → ManualApproval → Build). <b>CodeBuild</b> pulls SAML certs from S3 and Docker creds from " +
    "Secrets Manager, builds the multi-stage <b>node:18-alpine</b> image, pushes it to <b>ECR</b>, then " +
    "<code>kubectl set image</code> rolls it onto the <b>reciter-pm-prod</b> / <b>reciter-pm-dev</b> " +
    "Deployment. Traffic enters via an ALB Ingress → Service → Pod (:3000); the pod reads ReCiterDB and " +
    "calls the ReCiter / PubMed APIs.",
  legend: [
    { fill: "#f0ebff", stroke: "#7048e8", label: "AWS managed (CI/CD)" },
    { fill: "#e3faf3", stroke: "#0ca678", label: "Workload (Deployment / Pod)" },
    { fill: "#e7ecff", stroke: "#4263eb", label: "Service / network" },
    { fill: "#fbeaea", stroke: "#7d1c1c", label: "Ingress (ALB)" },
    { fill: "#fff4d6", stroke: "#f08c00", label: "Data / config store" },
  ],
  edgeLegend: [
    { color: "violet", label: "image build / deploy" },
    { color: "maroon", label: "inbound HTTPS" },
    { color: "indigo", label: "in-cluster routing" },
    { color: "amber", label: "data" },
    { color: "gray", dash: true, label: "config / control" },
  ],
  footnote:
    "Deploys are gated by a <b>ManualApproval</b> stage in CodePipeline; <code>*dev</code> branches roll to " +
    "<code>reciter-pm-dev</code> and <code>master</code> to <code>reciter-pm-prod</code> in the same namespace.",
  seeAlso: [
    { id: "system-context", label: "① context" },
    { id: "app-internals", label: "② internals" },
  ],
  source: "k8-buildspec.yml · Dockerfile · kubernetes/k8-deployment.yaml · kubernetes/k8-service.yaml · kubernetes/k8-secrets.yaml",
};
