// 轨道：Catmull-Rom 曲线 → 按弧长等距重采样，O(1) 查询任意弧长位置与切线
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const f = (a, b, c, d) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

export class Path {
  constructor(ctrl, step = 2) {
    const n = ctrl.length;
    const dense = [];
    for (let i = 0; i < n - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(n - 1, i + 2)];
      const k = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 3));
      for (let j = 0; j < k; j++) dense.push(cr(p0, p1, p2, p3, j / k));
    }
    dense.push(ctrl[n - 1].slice());

    const cum = [0];
    for (let i = 1; i < dense.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
    }
    const L = cum[cum.length - 1];
    const N = Math.ceil(L / step) + 1;
    this.length = L;
    this.step = step;
    this.N = N;
    this.xs = new Float32Array(N);
    this.ys = new Float32Array(N);
    let j = 0;
    for (let k = 0; k < N; k++) {
      const s = Math.min(k * step, L);
      while (j < dense.length - 2 && cum[j + 1] < s) j++;
      const seg = cum[j + 1] - cum[j];
      const t = seg > 0 ? (s - cum[j]) / seg : 0;
      this.xs[k] = dense[j][0] + (dense[j + 1][0] - dense[j][0]) * t;
      this.ys[k] = dense[j][1] + (dense[j + 1][1] - dense[j][1]) * t;
    }
    this.tx = new Float32Array(N);
    this.ty = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const a = Math.max(0, k - 2), b = Math.min(N - 1, k + 2);
      const dx = this.xs[b] - this.xs[a], dy = this.ys[b] - this.ys[a];
      const l = Math.hypot(dx, dy) || 1;
      this.tx[k] = dx / l;
      this.ty[k] = dy / l;
    }
  }

  // 写入 out {x,y,tx,ty}；s 超出范围时沿端点切线外推
  at(s, out) {
    const N = this.N;
    if (s <= 0) {
      out.tx = this.tx[0]; out.ty = this.ty[0];
      out.x = this.xs[0] + out.tx * s; out.y = this.ys[0] + out.ty * s;
      return out;
    }
    if (s >= this.length) {
      const e = this.length;
      out.tx = this.tx[N - 1]; out.ty = this.ty[N - 1];
      out.x = this.xs[N - 1] + out.tx * (s - e); out.y = this.ys[N - 1] + out.ty * (s - e);
      return out;
    }
    const f = s / this.step;
    const i = Math.floor(f), t = f - i, i1 = Math.min(i + 1, N - 1);
    out.x = this.xs[i] + (this.xs[i1] - this.xs[i]) * t;
    out.y = this.ys[i] + (this.ys[i1] - this.ys[i]) * t;
    out.tx = this.tx[i];
    out.ty = this.ty[i];
    return out;
  }
}
