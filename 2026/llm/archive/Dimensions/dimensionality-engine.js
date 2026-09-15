(function () {
  'use strict';

  var C = window.DIMENSIONALITY_CONFIG; /* per-page configuration */
  var DIM = C.dim; /* 1, 2 or 3 */

  var FA = '۰۱۲۳۴۵۶۷۸۹';
  function fa(n) {
    return String(n).replace(/\d/g, function (d) {
      return FA.charAt(+d);
    });
  }
  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  var D2R = Math.PI / 180;
  var RM =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ROOM = { X: 10, Y: 10, Z: 7 };
  var CX = C.cx,
    CY = C.cy,
    S = C.s,
    FOCAL = 52;
  var FZ = C.fz; /* height the camera is aimed at */

  var st = {
    x: C.x,
    y: C.y || 0,
    z: C.z || 0,
    az: C.az * D2R,
    el: C.el * D2R,
  };

  /* ---------------- projection: the whole 3D engine lives here ------------ */
  function proj(x, y, z) {
    var cx = x - ROOM.X / 2,
      cy = y - ROOM.Y / 2,
      cz = z - FZ;
    var ca = Math.cos(st.az),
      sa = Math.sin(st.az);
    var u = cx * ca + cy * sa; /* camera-right   */
    var v = -cx * sa + cy * ca; /* camera-forward */
    var w = cz; /* up             */
    var ce = Math.cos(st.el),
      se = Math.sin(st.el);
    var up = v * se + w * ce;
    var depth = v * ce - w * se;
    var k = FOCAL / (FOCAL + depth); /* mild perspective */
    return { x: CX + u * S * k, y: CY - up * S * k, d: depth };
  }

  function line(a, b, cls, extra) {
    return (
      '<line x1="' +
      a.x.toFixed(1) +
      '" y1="' +
      a.y.toFixed(1) +
      '" x2="' +
      b.x.toFixed(1) +
      '" y2="' +
      b.y.toFixed(1) +
      '" class="' +
      cls +
      '"' +
      (extra || '') +
      '/>'
    );
  }
  function poly(pts, cls, extra) {
    var s = '';
    for (var i = 0; i < pts.length; i++) {
      s += (i ? ' ' : '') + pts[i].x.toFixed(1) + ',' + pts[i].y.toFixed(1);
    }
    return (
      '<polygon points="' + s + '" class="' + cls + '"' + (extra || '') + '/>'
    );
  }
  function txt(p, str, cls, extra) {
    return (
      '<text x="' +
      p.x.toFixed(1) +
      '" y="' +
      p.y.toFixed(1) +
      '" text-anchor="middle" dominant-baseline="middle" class="' +
      cls +
      '"' +
      (extra || '') +
      '>' +
      str +
      '</text>'
    );
  }
  function disc(cx, cy, z, r, n) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      pts.push(proj(cx + r * Math.cos(a), cy + r * Math.sin(a), z));
    }
    return pts;
  }
  function offLabel(a, b, dist) {
    var mx = (a.x + b.x) / 2,
      my = (a.y + b.y) / 2;
    var dx = b.x - a.x,
      dy = b.y - a.y,
      L = Math.hypot(dx, dy) || 1;
    var nx = -dy / L,
      ny = dx / L;
    var c = proj(ROOM.X / 2, ROOM.Y / 2, FZ);
    if ((mx - c.x) * nx + (my - c.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { x: mx + nx * dist, y: my + ny * dist };
  }
  function arrow(from, to, cls) {
    var dx = to.x - from.x,
      dy = to.y - from.y,
      L = Math.hypot(dx, dy) || 1;
    var ux = dx / L,
      uy = dy / L,
      px = -uy,
      py = ux,
      h = 13,
      w = 5.2;
    var b = { x: to.x - ux * h, y: to.y - uy * h };
    return (
      '<polygon points="' +
      to.x.toFixed(1) +
      ',' +
      to.y.toFixed(1) +
      ' ' +
      (b.x + px * w).toFixed(1) +
      ',' +
      (b.y + py * w).toFixed(1) +
      ' ' +
      (b.x - px * w).toFixed(1) +
      ',' +
      (b.y - py * w).toFixed(1) +
      '" class="' +
      cls +
      '"/>'
    );
  }
  function boxEdges(cls) {
    var e = '',
      i;
    for (i = 0; i < 2; i++) {
      var z = i ? ROOM.Z : 0;
      e +=
        line(proj(0, 0, z), proj(ROOM.X, 0, z), cls) +
        line(proj(ROOM.X, 0, z), proj(ROOM.X, ROOM.Y, z), cls) +
        line(proj(ROOM.X, ROOM.Y, z), proj(0, ROOM.Y, z), cls) +
        line(proj(0, ROOM.Y, z), proj(0, 0, z), cls);
    }
    e +=
      line(proj(0, 0, 0), proj(0, 0, ROOM.Z), cls) +
      line(proj(ROOM.X, 0, 0), proj(ROOM.X, 0, ROOM.Z), cls) +
      line(proj(ROOM.X, ROOM.Y, 0), proj(ROOM.X, ROOM.Y, ROOM.Z), cls) +
      line(proj(0, ROOM.Y, 0), proj(0, ROOM.Y, ROOM.Z), cls);
    return e;
  }

  /* ---------------- the drone ---------------- */
  var rotors = [],
    phase = 0;
  var LIFT =
    C.lift || 0; /* pages where z is locked: hover just above the spot */

  function droneSVG(x, y, z) {
    var arm = 0.66,
      rotR = 0.44,
      bh = 0.3,
      bt = 0.1,
      items = [];
    var offs = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ],
      rdata = [],
      i;

    for (i = 0; i < offs.length; i++) {
      var rx = x + offs[i][0] * arm,
        ry = y + offs[i][1] * arm,
        rz = z + 0.1;
      var c = proj(rx, ry, rz);
      rdata.push({ cx: rx, cy: ry, cz: rz, r: rotR });
      items.push({
        d: c.d,
        s:
          poly(disc(rx, ry, z - 0.02, 0.1, 10), 's-body') +
          poly(disc(rx, ry, rz, rotR, 20), 's-rotor') +
          '<path class="s-blade" data-rotor="' +
          i +
          '" d=""/>',
      });
    }

    var chassis = '';
    for (i = 0; i < offs.length; i++) {
      chassis += line(
        proj(x, y, z),
        proj(x + offs[i][0] * arm, y + offs[i][1] * arm, z + 0.06),
        's-arm'
      );
    }
    var zb = z - bt,
      zt = z + bt;
    var V = {
      a: proj(x - bh, y - bh, zb),
      b: proj(x + bh, y - bh, zb),
      c: proj(x + bh, y + bh, zb),
      d: proj(x - bh, y + bh, zb),
      e: proj(x - bh, y - bh, zt),
      f: proj(x + bh, y - bh, zt),
      g: proj(x + bh, y + bh, zt),
      h: proj(x - bh, y + bh, zt),
    };
    var faces = [
      { p: [V.e, V.f, V.g, V.h], cls: 's-body-t' },
      { p: [V.a, V.b, V.c, V.d], cls: 's-body' },
      { p: [V.a, V.b, V.f, V.e], cls: 's-body' },
      { p: [V.b, V.c, V.g, V.f], cls: 's-body' },
      { p: [V.c, V.d, V.h, V.g], cls: 's-body' },
      { p: [V.d, V.a, V.e, V.h], cls: 's-body' },
    ];
    faces.sort(function (A, B) {
      return (
        (B.p[0].d + B.p[1].d + B.p[2].d + B.p[3].d) / 4 -
        (A.p[0].d + A.p[1].d + A.p[2].d + A.p[3].d) / 4
      );
    });
    for (i = 0; i < faces.length; i++) {
      chassis += poly(faces[i].p, faces[i].cls);
    }
    chassis += line(proj(x, y, z - bt), proj(x, y, z - 0.22), 's-arm');
    chassis += poly(disc(x, y, z - 0.24, 0.13, 10), 's-body');

    items.push({ d: proj(x, y, z).d, s: chassis });
    items.sort(function (a, b) {
      return b.d - a.d;
    });

    rotors = rdata;
    var out = '';
    for (i = 0; i < items.length; i++) {
      out += items[i].s;
    }
    return out;
  }

  function spinBlades() {
    var nodes = document.querySelectorAll('.s-blade');
    for (var i = 0; i < nodes.length; i++) {
      var r = rotors[+nodes[i].getAttribute('data-rotor')];
      if (!r) continue;
      var d = '';
      for (var b = 0; b < 2; b++) {
        var a = phase + (b * Math.PI) / 2;
        var p1 = proj(
          r.cx + r.r * 0.9 * Math.cos(a),
          r.cy + r.r * 0.9 * Math.sin(a),
          r.cz
        );
        var p2 = proj(
          r.cx - r.r * 0.9 * Math.cos(a),
          r.cy - r.r * 0.9 * Math.sin(a),
          r.cz
        );
        d +=
          'M' +
          p1.x.toFixed(1) +
          ',' +
          p1.y.toFixed(1) +
          'L' +
          p2.x.toFixed(1) +
          ',' +
          p2.y.toFixed(1);
      }
      nodes[i].setAttribute('d', d);
    }
  }

  /* ---------------- the scene ---------------- */
  function render() {
    var x = st.x,
      y = DIM >= 2 ? st.y : 0,
      z = DIM >= 3 ? st.z : 0;
    var s = '',
      i;

    /* walls: only in 3D, and only the two furthest from the camera */
    if (DIM === 3) {
      var walls = [
        { c: proj(0, ROOM.Y / 2, ROOM.Z / 2), axis: 'x', at: 0 },
        {
          c: proj(ROOM.X, ROOM.Y / 2, ROOM.Z / 2),
          axis: 'x',
          at: ROOM.X,
        },
        { c: proj(ROOM.X / 2, 0, ROOM.Z / 2), axis: 'y', at: 0 },
        {
          c: proj(ROOM.X / 2, ROOM.Y, ROOM.Z / 2),
          axis: 'y',
          at: ROOM.Y,
        },
      ];
      walls.sort(function (a, b) {
        return b.c.d - a.c.d;
      });
      for (var wi = 0; wi < 2; wi++) {
        var W = walls[wi],
          q,
          gl = '';
        if (W.axis === 'x') {
          q = [
            proj(W.at, 0, 0),
            proj(W.at, ROOM.Y, 0),
            proj(W.at, ROOM.Y, ROOM.Z),
            proj(W.at, 0, ROOM.Z),
          ];
          for (i = 0; i <= ROOM.Y; i++)
            gl += line(proj(W.at, i, 0), proj(W.at, i, ROOM.Z), 's-grid-w');
          for (i = 0; i <= ROOM.Z; i++)
            gl += line(proj(W.at, 0, i), proj(W.at, ROOM.Y, i), 's-grid-w');
        } else {
          q = [
            proj(0, W.at, 0),
            proj(ROOM.X, W.at, 0),
            proj(ROOM.X, W.at, ROOM.Z),
            proj(0, W.at, ROOM.Z),
          ];
          for (i = 0; i <= ROOM.X; i++)
            gl += line(proj(i, W.at, 0), proj(i, W.at, ROOM.Z), 's-grid-w');
          for (i = 0; i <= ROOM.Z; i++)
            gl += line(proj(0, W.at, i), proj(ROOM.X, W.at, i), 's-grid-w');
        }
        s += poly(q, 's-wall') + gl;
      }
    }

    /* on the line page, a faint footprint of the gym: the room is bigger than the line */
    if (DIM === 1) {
      s += poly(
        [
          proj(0, 0, 0),
          proj(ROOM.X, 0, 0),
          proj(ROOM.X, ROOM.Y, 0),
          proj(0, ROOM.Y, 0),
        ],
        's-ghost',
        ' fill="none"'
      );
    }

    /* floor */
    var floorQ = [
      proj(0, 0, 0),
      proj(ROOM.X, 0, 0),
      proj(ROOM.X, ROOM.Y, 0),
      proj(0, ROOM.Y, 0),
    ];
    if (DIM >= 2) {
      var fl = poly(floorQ, 's-floor');
      for (i = 0; i <= ROOM.X; i++)
        fl += line(proj(i, 0, 0), proj(i, ROOM.Y, 0), 's-grid');
      for (i = 0; i <= ROOM.Y; i++)
        fl += line(proj(0, i, 0), proj(ROOM.X, i, 0), 's-grid');
      fl += poly(floorQ, 's-edge', ' fill="none"');
      s += fl;
    }

    /* --- where the drone is allowed to be: line -> plane -> space --- */
    if (DIM === 1) {
      s += line(proj(0, 0, 0), proj(ROOM.X, 0, 0), 's-dom-line');
    } else if (DIM === 2) {
      s += poly(floorQ, 's-dom-face');
    } else {
      s += poly(floorQ, 's-dom-face') + boxEdges('s-dom-edge');
    }

    /* axes */
    var O = proj(0, 0, 0);
    function axis(cls, endW, tickDir, numDir, labelW, screenOff, letter, word) {
      var E = proj(endW[0], endW[1], endW[2]);
      var g =
        line(O, E, 's-ax ' + cls) +
        arrow(
          proj(endW[0] * 0.9, endW[1] * 0.9, endW[2] * 0.9),
          E,
          cls.replace('-c', '-f')
        );
      var lim = Math.max(endW[0], endW[1], endW[2]);
      for (var i = 1; i <= lim; i++) {
        var base = [endW[0] ? i : 0, endW[1] ? i : 0, endW[2] ? i : 0];
        g += line(
          proj(base[0], base[1], base[2]),
          proj(
            base[0] + tickDir[0],
            base[1] + tickDir[1],
            base[2] + tickDir[2]
          ),
          's-tick ' + cls
        );
        if (i % 2 === 0 && i !== lim)
          g += txt(
            proj(base[0] + numDir[0], base[1] + numDir[1], base[2] + numDir[2]),
            fa(i),
            's-tnum'
          );
      }
      var Lq = proj(labelW[0], labelW[1], labelW[2]);
      var Lp = { x: Lq.x + screenOff[0], y: Lq.y + screenOff[1] };
      g += txt(Lp, letter, 's-axlabel ' + cls.replace('-c', '-f'));
      g += txt(
        { x: Lp.x, y: Lp.y + 21 },
        word,
        's-axword ' + cls.replace('-c', '-f')
      );
      return g;
    }
    s += axis(
      'x-c',
      [ROOM.X, 0, 0],
      [0, -0.28, 0],
      [0, -0.95, 0],
      [ROOM.X + 1.15, -1.15, 0],
      [0, 0],
      'x',
      'به راست'
    );
    if (DIM >= 2)
      s += axis(
        'y-c',
        [0, ROOM.Y, 0],
        [-0.28, 0, 0],
        [-0.95, 0, 0],
        [-1.15, ROOM.Y + 1.15, 0],
        [0, 0],
        'y',
        'به جلو'
      );
    if (DIM >= 3)
      s += axis(
        'z-c',
        [0, 0, ROOM.Z],
        [-0.24, -0.24, 0],
        [-0.78, -0.78, 0],
        [0, 0, ROOM.Z],
        [0, -38],
        'z',
        'به بالا'
      );

    s +=
      '<circle cx="' +
      O.x.toFixed(1) +
      '" cy="' +
      O.y.toFixed(1) +
      '" r="4.5" class="s-dot" style="stroke:var(--ink)"/>';
    s += txt(proj(-1.15, -1.15, 0), 'مبدأ', 's-origin');

    /* shadow on the floor */
    if (DIM >= 2) {
      var sr = 0.42 + (z + LIFT) * 0.055,
        so = clamp(0.3 - (z + LIFT) * 0.026, 0.07, 0.3);
      s += poly(
        disc(x, y, 0.012, sr, 18),
        's-shadow',
        ' fill-opacity="' + so.toFixed(2) + '"'
      );
    }

    /* the coordinate staircase: one leg per number */
    var A = proj(0, 0, 0),
      B = proj(x, 0, 0),
      Cp = proj(x, y, 0),
      Dp = proj(x, y, z);
    if (DIM >= 2 && y > 0 && x > 0) s += line(Cp, proj(0, y, 0), 's-help y-c');
    if (x > 0) s += line(A, B, 's-leg x-c');
    if (DIM >= 2 && y > 0) s += line(B, Cp, 's-leg y-c');
    if (DIM >= 3 && z > 0) s += line(Cp, Dp, 's-leg z-c');
    if (DIM >= 2)
      s +=
        '<circle cx="' +
        B.x.toFixed(1) +
        '" cy="' +
        B.y.toFixed(1) +
        '" r="4" class="s-dot" style="stroke:var(--ax-x)"/>';
    if (DIM >= 3)
      s +=
        '<circle cx="' +
        Cp.x.toFixed(1) +
        '" cy="' +
        Cp.y.toFixed(1) +
        '" r="4" class="s-dot" style="stroke:var(--ax-y)"/>';
    if (x > 0) s += txt(offLabel(A, B, 23), fa(x) + ' متر', 's-val x-f');
    if (DIM >= 2 && y > 0)
      s += txt(offLabel(B, Cp, 23), fa(y) + ' متر', 's-val y-f');
    if (DIM >= 3 && z > 0)
      s += txt(offLabel(Cp, Dp, 26), fa(z) + ' متر', 's-val z-f');

    /* the drone */
    if (LIFT) s += line(Dp, proj(x, y, z + LIFT - 0.3), 's-gear');
    s += droneSVG(x, y, z + LIFT);
    s +=
      '<circle cx="' +
      Dp.x.toFixed(1) +
      '" cy="' +
      Dp.y.toFixed(1) +
      '" r="3" style="fill:var(--ink)"/>';

    var top = proj(x, y, z + LIFT);
    var tag = '<tspan class="x-f">' + fa(x) + '</tspan>';
    if (DIM >= 2)
      tag +=
        '<tspan style="fill:var(--muted)">, </tspan><tspan class="y-f">' +
        fa(y) +
        '</tspan>';
    if (DIM >= 3)
      tag +=
        '<tspan style="fill:var(--muted)">, </tspan><tspan class="z-f">' +
        fa(z) +
        '</tspan>';
    s +=
      '<text x="' +
      top.x.toFixed(1) +
      '" y="' +
      (top.y - 72).toFixed(1) +
      '" text-anchor="middle" class="s-dronelabel">' +
      '<tspan style="fill:var(--muted)">(</tspan>' +
      tag +
      '<tspan style="fill:var(--muted)">)</tspan></text>';
    s += txt({ x: top.x, y: top.y - 50 }, 'پهپاد', 's-dronename');

    document.getElementById('scene').innerHTML = s;
    spinBlades();
  }

  /* ---------------- readouts ---------------- */
  var $ = function (id) {
    return document.getElementById(id);
  };
  var elTriple = $('triple'),
    elSentence = $('sentence');

  function meters(n) {
    return fa(n) + ' <small>متر</small>';
  }

  function paint() {
    var x = st.x,
      y = st.y,
      z = st.z;

    var t = '<span class="p">(</span><span class="cx">' + fa(x) + '</span>';
    if (DIM >= 2)
      t +=
        '<span class="p">،&nbsp;</span><span class="cy">' + fa(y) + '</span>';
    if (DIM >= 3)
      t +=
        '<span class="p">،&nbsp;</span><span class="cz">' + fa(z) + '</span>';
    elTriple.innerHTML = t + '<span class="p">)</span>';

    if (DIM === 1) {
      elSentence.innerHTML =
        'پهپاد <b>' + fa(x) + ' متر به راست</b> از مبدأ است.';
    } else if (DIM === 2) {
      elSentence.innerHTML =
        'پهپاد <b>' +
        fa(x) +
        ' متر به راست</b> و <b>' +
        fa(y) +
        ' متر به جلو</b> از مبدأ است.';
    } else {
      elSentence.innerHTML =
        'پهپاد <b>' +
        fa(x) +
        ' متر به راست</b>، <b>' +
        fa(y) +
        ' متر به جلو</b> و <b>' +
        fa(z) +
        ' متر بالاتر</b> از مبدأ است.';
    }

    var axes = [
      ['x', x, 10],
      ['y', y, 10],
      ['z', z, 7],
    ];
    for (var i = 0; i < DIM; i++) {
      var k = axes[i][0],
        v = axes[i][1],
        mx = axes[i][2];
      $('val-' + k).innerHTML = meters(v);
      var inp = $('in-' + k);
      inp.value = v;
      inp.style.setProperty('--fill', (v / mx) * 100 + '%');
    }
  }

  function update() {
    paint();
    render();
  }

  ['x', 'y', 'z'].slice(0, DIM).forEach(function (k) {
    $('in-' + k).addEventListener('input', function () {
      st[k] = +this.value;
      update();
    });
  });

  /* view presets, tweened so the change of viewpoint reads */
  var tween = null;
  function setView(az, el) {
    az *= D2R;
    el *= D2R;
    while (az - st.az > Math.PI) az -= 2 * Math.PI;
    while (az - st.az < -Math.PI) az += 2 * Math.PI;
    if (RM) {
      st.az = az;
      st.el = el;
      update();
      return;
    }
    var a0 = st.az,
      e0 = st.el,
      t0 = performance.now(),
      dur = 620;
    if (tween) cancelAnimationFrame(tween);
    (function step(now) {
      var t = clamp((now - t0) / dur, 0, 1);
      var k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      st.az = a0 + (az - a0) * k;
      st.el = e0 + (el - e0) * k;
      update();
      tween = t < 1 ? requestAnimationFrame(step) : null;
    })(t0);
  }
  C.views.forEach(function (v, i) {
    var b = $('v' + i);
    if (b)
      b.addEventListener('click', function () {
        setView(v.az, v.el);
      });
  });

  /* drag to orbit */
  var svg = $('scene'),
    drag = null;
  svg.addEventListener('pointerdown', function (e) {
    if (tween) {
      cancelAnimationFrame(tween);
      tween = null;
    }
    drag = { px: e.clientX, py: e.clientY };
    svg.classList.add('dragging');
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', function (e) {
    if (!drag) return;
    st.az += (e.clientX - drag.px) * 0.0085;
    st.el = clamp(st.el - (e.clientY - drag.py) * 0.006, 3 * D2R, 87 * D2R);
    drag.px = e.clientX;
    drag.py = e.clientY;
    update();
  });
  function endDrag(e) {
    if (!drag) return;
    drag = null;
    svg.classList.remove('dragging');
    try {
      svg.releasePointerCapture(e.pointerId);
    } catch {}
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  /* propellers */
  if (!RM) {
    var last = 0;
    (function loop(now) {
      requestAnimationFrame(loop);
      if (document.hidden || now - last < 45) return;
      last = now;
      phase += 0.55;
      spinBlades();
    })(0);
  }

  update();
})();
