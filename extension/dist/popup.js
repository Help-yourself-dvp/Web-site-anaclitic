"use strict";
(() => {
  // node_modules/fflate/esm/browser.js
  var u8 = Uint8Array;
  var u16 = Uint16Array;
  var i32 = Int32Array;
  var fleb = new u8([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    /* unused */
    0,
    0,
    /* impossible */
    0
  ]);
  var fdeb = new u8([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    /* unused */
    0,
    0
  ]);
  var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var freb = function(eb, start) {
    var b = new u16(31);
    for (var i = 0; i < 31; ++i) {
      b[i] = start += 1 << eb[i - 1];
    }
    var r = new i32(b[30]);
    for (var i = 1; i < 30; ++i) {
      for (var j = b[i]; j < b[i + 1]; ++j) {
        r[j] = j - b[i] << 5 | i;
      }
    }
    return { b, r };
  };
  var _a = freb(fleb, 2);
  var fl = _a.b;
  var revfl = _a.r;
  fl[28] = 258, revfl[258] = 28;
  var _b = freb(fdeb, 0);
  var fd = _b.b;
  var revfd = _b.r;
  var rev = new u16(32768);
  for (i = 0; i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  var x;
  var i;
  var hMap = function(cd, mb, r) {
    var s = cd.length;
    var i = 0;
    var l = new u16(mb);
    for (; i < s; ++i) {
      if (cd[i])
        ++l[cd[i] - 1];
    }
    var le = new u16(mb);
    for (i = 1; i < mb; ++i) {
      le[i] = le[i - 1] + l[i - 1] << 1;
    }
    var co;
    if (r) {
      co = new u16(1 << mb);
      var rvb = 15 - mb;
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          var sv = i << 4 | cd[i];
          var r_1 = mb - cd[i];
          var v = le[cd[i] - 1]++ << r_1;
          for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
            co[rev[v] >> rvb] = sv;
          }
        }
      }
    } else {
      co = new u16(s);
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
        }
      }
    }
    return co;
  };
  var flt = new u8(288);
  for (i = 0; i < 144; ++i)
    flt[i] = 8;
  var i;
  for (i = 144; i < 256; ++i)
    flt[i] = 9;
  var i;
  for (i = 256; i < 280; ++i)
    flt[i] = 7;
  var i;
  for (i = 280; i < 288; ++i)
    flt[i] = 8;
  var i;
  var fdt = new u8(32);
  for (i = 0; i < 32; ++i)
    fdt[i] = 5;
  var i;
  var flm = /* @__PURE__ */ hMap(flt, 9, 0);
  var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
  var shft = function(p) {
    return (p + 7) / 8 | 0;
  };
  var slc = function(v, s, e) {
    if (s == null || s < 0)
      s = 0;
    if (e == null || e > v.length)
      e = v.length;
    return new u8(v.subarray(s, e));
  };
  var ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    // determined by compression function
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
    // determined by unknown compression method
  ];
  var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
      Error.captureStackTrace(e, err);
    if (!nt)
      throw e;
    return e;
  };
  var wbits = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
  };
  var wbits16 = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
    d[o + 2] |= v >> 16;
  };
  var hTree = function(d, mb) {
    var t = [];
    for (var i = 0; i < d.length; ++i) {
      if (d[i])
        t.push({ s: i, f: d[i] });
    }
    var s = t.length;
    var t2 = t.slice();
    if (!s)
      return { t: et, l: 0 };
    if (s == 1) {
      var v = new u8(t[0].s + 1);
      v[t[0].s] = 1;
      return { t: v, l: 1 };
    }
    t.sort(function(a, b) {
      return a.f - b.f;
    });
    t.push({ s: -1, f: 25001 });
    var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
    t[0] = { s: -1, f: l.f + r.f, l, r };
    while (i1 != s - 1) {
      l = t[t[i0].f < t[i2].f ? i0++ : i2++];
      r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
      t[i1++] = { s: -1, f: l.f + r.f, l, r };
    }
    var maxSym = t2[0].s;
    for (var i = 1; i < s; ++i) {
      if (t2[i].s > maxSym)
        maxSym = t2[i].s;
    }
    var tr = new u16(maxSym + 1);
    var mbt = ln(t[i1 - 1], tr, 0);
    if (mbt > mb) {
      var i = 0, dt = 0;
      var lft = mbt - mb, cst = 1 << lft;
      t2.sort(function(a, b) {
        return tr[b.s] - tr[a.s] || a.f - b.f;
      });
      for (; i < s; ++i) {
        var i2_1 = t2[i].s;
        if (tr[i2_1] > mb) {
          dt += cst - (1 << mbt - tr[i2_1]);
          tr[i2_1] = mb;
        } else
          break;
      }
      dt >>= lft;
      while (dt > 0) {
        var i2_2 = t2[i].s;
        if (tr[i2_2] < mb)
          dt -= 1 << mb - tr[i2_2]++ - 1;
        else
          ++i;
      }
      for (; i >= 0 && dt; --i) {
        var i2_3 = t2[i].s;
        if (tr[i2_3] == mb) {
          --tr[i2_3];
          ++dt;
        }
      }
      mbt = mb;
    }
    return { t: new u8(tr), l: mbt };
  };
  var ln = function(n, l, d) {
    return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
  };
  var lc = function(c) {
    var s = c.length;
    while (s && !c[--s])
      ;
    var cl = new u16(++s);
    var cli = 0, cln = c[0], cls = 1;
    var w = function(v) {
      cl[cli++] = v;
    };
    for (var i = 1; i <= s; ++i) {
      if (c[i] == cln && i != s)
        ++cls;
      else {
        if (!cln && cls > 2) {
          for (; cls > 138; cls -= 138)
            w(32754);
          if (cls > 2) {
            w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
            cls = 0;
          }
        } else if (cls > 3) {
          w(cln), --cls;
          for (; cls > 6; cls -= 6)
            w(8304);
          if (cls > 2)
            w(cls - 3 << 5 | 8208), cls = 0;
        }
        while (cls--)
          w(cln);
        cls = 1;
        cln = c[i];
      }
    }
    return { c: cl.subarray(0, cli), n: s };
  };
  var clen = function(cf, cl) {
    var l = 0;
    for (var i = 0; i < cl.length; ++i)
      l += cf[i] * cl[i];
    return l;
  };
  var wfblk = function(out, pos, dat) {
    var s = dat.length;
    var o = shft(pos + 2);
    out[o] = s & 255;
    out[o + 1] = s >> 8;
    out[o + 2] = out[o] ^ 255;
    out[o + 3] = out[o + 1] ^ 255;
    for (var i = 0; i < s; ++i)
      out[o + i + 4] = dat[i];
    return (o + 4 + s) * 8;
  };
  var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
    wbits(out, p++, final);
    ++lf[256];
    var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
    var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
    var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
    var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
    var lcfreq = new u16(19);
    for (var i = 0; i < lclt.length; ++i)
      ++lcfreq[lclt[i] & 31];
    for (var i = 0; i < lcdt.length; ++i)
      ++lcfreq[lcdt[i] & 31];
    var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
    var nlcc = 19;
    for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
      ;
    var flen = bl + 5 << 3;
    var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
    var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
    if (bs >= 0 && flen <= ftlen && flen <= dtlen)
      return wfblk(out, p, dat.subarray(bs, bs + bl));
    var lm, ll, dm, dl;
    wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
    if (dtlen < ftlen) {
      lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
      var llm = hMap(lct, mlcb, 0);
      wbits(out, p, nlc - 257);
      wbits(out, p + 5, ndc - 1);
      wbits(out, p + 10, nlcc - 4);
      p += 14;
      for (var i = 0; i < nlcc; ++i)
        wbits(out, p + 3 * i, lct[clim[i]]);
      p += 3 * nlcc;
      var lcts = [lclt, lcdt];
      for (var it = 0; it < 2; ++it) {
        var clct = lcts[it];
        for (var i = 0; i < clct.length; ++i) {
          var len = clct[i] & 31;
          wbits(out, p, llm[len]), p += lct[len];
          if (len > 15)
            wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
        }
      }
    } else {
      lm = flm, ll = flt, dm = fdm, dl = fdt;
    }
    for (var i = 0; i < li; ++i) {
      var sym = syms[i];
      if (sym > 255) {
        var len = sym >> 18 & 31;
        wbits16(out, p, lm[len + 257]), p += ll[len + 257];
        if (len > 7)
          wbits(out, p, sym >> 23 & 31), p += fleb[len];
        var dst = sym & 31;
        wbits16(out, p, dm[dst]), p += dl[dst];
        if (dst > 3)
          wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
      } else {
        wbits16(out, p, lm[sym]), p += ll[sym];
      }
    }
    wbits16(out, p, lm[256]);
    return p + ll[256];
  };
  var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
  var et = /* @__PURE__ */ new u8(0);
  var dflt = function(dat, lvl, plvl, pre, post, st) {
    var s = st.z || dat.length;
    var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
    var w = o.subarray(pre, o.length - post);
    var lst = st.l;
    var pos = (st.r || 0) & 7;
    if (lvl) {
      if (pos)
        w[0] = st.r >> 3;
      var opt = deo[lvl - 1];
      var n = opt >> 13, c = opt & 8191;
      var msk_1 = (1 << plvl) - 1;
      var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
      var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
      var hsh = function(i2) {
        return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
      };
      var syms = new i32(25e3);
      var lf = new u16(288), df = new u16(32);
      var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
      for (; i + 2 < s; ++i) {
        var hv = hsh(i);
        var imod = i & 32767, pimod = head[hv];
        prev[imod] = pimod;
        head[hv] = imod;
        if (wi <= i) {
          var rem = s - i;
          if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
            pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
            li = lc_1 = eb = 0, bs = i;
            for (var j = 0; j < 286; ++j)
              lf[j] = 0;
            for (var j = 0; j < 30; ++j)
              df[j] = 0;
          }
          var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
          if (rem > 2 && hv == hsh(i - dif)) {
            var maxn = Math.min(n, rem) - 1;
            var maxd = Math.min(32767, i);
            var ml = Math.min(258, rem);
            while (dif <= maxd && --ch_1 && imod != pimod) {
              if (dat[i + l] == dat[i + l - dif]) {
                var nl = 0;
                for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                  ;
                if (nl > l) {
                  l = nl, d = dif;
                  if (nl > maxn)
                    break;
                  var mmd = Math.min(dif, nl - 2);
                  var md = 0;
                  for (var j = 0; j < mmd; ++j) {
                    var ti = i - dif + j & 32767;
                    var pti = prev[ti];
                    var cd = ti - pti & 32767;
                    if (cd > md)
                      md = cd, pimod = ti;
                  }
                }
              }
              imod = pimod, pimod = prev[imod];
              dif += imod - pimod & 32767;
            }
          }
          if (d) {
            syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
            var lin = revfl[l] & 31, din = revfd[d] & 31;
            eb += fleb[lin] + fdeb[din];
            ++lf[257 + lin];
            ++df[din];
            wi = i + l;
            ++lc_1;
          } else {
            syms[li++] = dat[i];
            ++lf[dat[i]];
          }
        }
      }
      for (i = Math.max(i, wi); i < s; ++i) {
        syms[li++] = dat[i];
        ++lf[dat[i]];
      }
      pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
      if (!lst) {
        st.r = pos & 7 | w[pos / 8 | 0] << 3;
        pos -= 7;
        st.h = head, st.p = prev, st.i = i, st.w = wi;
      }
    } else {
      for (var i = st.w || 0; i < s + lst; i += 65535) {
        var e = i + 65535;
        if (e >= s) {
          w[pos / 8 | 0] = lst;
          e = s;
        }
        pos = wfblk(w, pos + 1, dat.subarray(i, e));
      }
      st.i = s;
    }
    return slc(o, 0, pre + shft(pos) + post);
  };
  var crct = /* @__PURE__ */ function() {
    var t = new Int32Array(256);
    for (var i = 0; i < 256; ++i) {
      var c = i, k = 9;
      while (--k)
        c = (c & 1 && -306674912) ^ c >>> 1;
      t[i] = c;
    }
    return t;
  }();
  var crc = function() {
    var c = -1;
    return {
      p: function(d) {
        var cr = c;
        for (var i = 0; i < d.length; ++i)
          cr = crct[cr & 255 ^ d[i]] ^ cr >>> 8;
        c = cr;
      },
      d: function() {
        return ~c;
      }
    };
  };
  var dopt = function(dat, opt, pre, post, st) {
    if (!st) {
      st = { l: 1 };
      if (opt.dictionary) {
        var dict = opt.dictionary.subarray(-32768);
        var newDat = new u8(dict.length + dat.length);
        newDat.set(dict);
        newDat.set(dat, dict.length);
        dat = newDat;
        st.w = dict.length;
      }
    }
    return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
  };
  var mrg = function(a, b) {
    var o = {};
    for (var k in a)
      o[k] = a[k];
    for (var k in b)
      o[k] = b[k];
    return o;
  };
  var wbytes = function(d, b, v) {
    for (; v; ++b)
      d[b] = v, v >>>= 8;
  };
  function deflateSync(data, opts) {
    return dopt(data, opts || {}, 0, 0);
  }
  var fltn = function(d, p, t, o) {
    for (var k in d) {
      var val = d[k], n = p + k, op = o;
      if (Array.isArray(val))
        op = mrg(o, val[1]), val = val[0];
      if (ArrayBuffer.isView(val))
        t[n] = [val, op];
      else {
        t[n += "/"] = [new u8(0), op];
        fltn(val, n, t, o);
      }
    }
  };
  var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }
  function strToU8(str, latin1) {
    if (latin1) {
      var ar_1 = new u8(str.length);
      for (var i = 0; i < str.length; ++i)
        ar_1[i] = str.charCodeAt(i);
      return ar_1;
    }
    if (te)
      return te.encode(str);
    var l = str.length;
    var ar = new u8(str.length + (str.length >> 1));
    var ai = 0;
    var w = function(v) {
      ar[ai++] = v;
    };
    for (var i = 0; i < l; ++i) {
      if (ai + 5 > ar.length) {
        var n = new u8(ai + 8 + (l - i << 1));
        n.set(ar);
        ar = n;
      }
      var c = str.charCodeAt(i);
      if (c < 128 || latin1)
        w(c);
      else if (c < 2048)
        w(192 | c >> 6), w(128 | c & 63);
      else if (c > 55295 && c < 57344)
        c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
      else
        w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
    }
    return slc(ar, 0, ai);
  }
  var exfl = function(ex) {
    var le = 0;
    if (ex) {
      for (var k in ex) {
        var l = ex[k].length;
        if (l > 65535)
          err(9);
        le += l + 4;
      }
    }
    return le;
  };
  var wzh = function(d, b, f, fn, u, c, ce, co) {
    var fl2 = fn.length, ex = f.extra, col = co && co.length;
    var exl = exfl(ex);
    wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
    if (ce != null)
      d[b++] = 20, d[b++] = f.os;
    d[b] = 20, b += 2;
    d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
    d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
    var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
    if (y < 0 || y > 119)
      err(10);
    wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
    if (c != -1) {
      wbytes(d, b, f.crc);
      wbytes(d, b + 4, c < 0 ? -c - 2 : c);
      wbytes(d, b + 8, f.size);
    }
    wbytes(d, b + 12, fl2);
    wbytes(d, b + 14, exl), b += 16;
    if (ce != null) {
      wbytes(d, b, col);
      wbytes(d, b + 6, f.attrs);
      wbytes(d, b + 10, ce), b += 14;
    }
    d.set(fn, b);
    b += fl2;
    if (exl) {
      for (var k in ex) {
        var exf = ex[k], l = exf.length;
        wbytes(d, b, +k);
        wbytes(d, b + 2, l);
        d.set(exf, b + 4), b += 4 + l;
      }
    }
    if (col)
      d.set(co, b), b += col;
    return b;
  };
  var wzf = function(o, b, c, d, e) {
    wbytes(o, b, 101010256);
    wbytes(o, b + 8, c);
    wbytes(o, b + 10, c);
    wbytes(o, b + 12, d);
    wbytes(o, b + 16, e);
  };
  function zipSync(data, opts) {
    if (!opts)
      opts = {};
    var r = {};
    var files = [];
    fltn(data, "", r, opts);
    var o = 0;
    var tot = 0;
    for (var fn in r) {
      var _a2 = r[fn], file = _a2[0], p = _a2[1];
      var compression = p.level == 0 ? 0 : 8;
      var f = strToU8(fn), s = f.length;
      var com = p.comment, m = com && strToU8(com), ms = m && m.length;
      var exl = exfl(p.extra);
      if (s > 65535)
        err(11);
      var d = compression ? deflateSync(file, p) : file, l = d.length;
      var c = crc();
      c.p(file);
      files.push(mrg(p, {
        size: file.length,
        crc: c.d(),
        c: d,
        f,
        m,
        u: s != fn.length || m && com.length != ms,
        o,
        compression
      }));
      o += 30 + s + exl + l;
      tot += 76 + 2 * (s + exl) + (ms || 0) + l;
    }
    var out = new u8(tot + 22), oe = o, cdl = tot - o;
    for (var i = 0; i < files.length; ++i) {
      var f = files[i];
      wzh(out, f.o, f, f.f, f.u, f.c.length);
      var badd = 30 + f.f.length + exfl(f.extra);
      out.set(f.c, f.o + badd);
      wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
    }
    wzf(out, o, files.length, cdl, oe);
    return out;
  }

  // src/core/utils.ts
  function parseTopicId(url) {
    try {
      const parsed = new URL(url);
      const showtopic = parsed.searchParams.get("showtopic");
      if (showtopic) return showtopic;
      const lofiTopic = parsed.search.match(/[?&]t(\d+)(?:-\d+)?\.html/i)?.[1];
      if (lofiTopic) return lofiTopic;
      const pathPart = parsed.pathname.split("/").filter(Boolean).pop();
      return pathPart || "unknown-topic";
    } catch {
      return "unknown-topic";
    }
  }

  // src/popup.ts
  var $ = (selector) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u044D\u043B\u0435\u043C\u0435\u043D\u0442 ${selector}`);
    return element;
  };
  var currentUrl = $("#currentUrl");
  var sourceSelect = $("#sourceSelect");
  var openSourceButton = $("#openSourceButton");
  var sourceInfo = $("#sourceInfo");
  var automaticInfo = $("#automaticInfo");
  var mediaInfo = $("#mediaInfo");
  var resetButton = $("#resetButton");
  var adapterBadge = $("#adapterBadge");
  var checkpointBadge = $("#checkpointBadge");
  var postCount = $("#postCount");
  var status = $("#status");
  var diagnostics = $("#diagnostics");
  var recentPosts = $("#recentPosts");
  var savedReports = $("#savedReports");
  var storageInfo = $("#storageInfo");
  var storageFooter = $("#storageFooter");
  var versionInfo = $("#versionInfo");
  var pagesInput = $("#pagesInput");
  var promptPreview = $("#promptPreview");
  var packageStatus = $("#packageStatus");
  var formatCheckboxes = Array.from(document.querySelectorAll('input[name="singleFormat"]'));
  var splitPackageButton = $("#splitPackageButton");
  var copyButton = $("#copyButton");
  var aiResponse = $("#aiResponse");
  var responseFile = $("#responseFile");
  var importResult = $("#importResult");
  var localSearch = $("#localSearch");
  var localSearchButton = $("#localSearchButton");
  var localSearchResult = $("#localSearchResult");
  var diagnosticStatus = $("#diagnosticStatus");
  var diagnosticPreview = $("#diagnosticPreview");
  var actionButtons = Array.from(
    document.querySelectorAll("button:not(#refreshButton):not(#settingsButton)")
  );
  var activeUrl = "";
  var currentState = null;
  var busy = false;
  async function send(request) {
    return chrome.runtime.sendMessage(request);
  }
  function setStatus(message, kind = "neutral") {
    status.textContent = message;
    status.className = `status ${kind}`;
  }
  function renderSourceSelect(state) {
    sourceSelect.replaceChildren();
    if (state.sources.length === 0) {
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0445 \u0442\u0435\u043C";
      sourceSelect.append(empty);
      sourceSelect.disabled = true;
      openSourceButton.disabled = true;
      return;
    }
    for (const source of state.sources) {
      const option = document.createElement("option");
      option.value = source.source_id;
      option.textContent = source.title || source.topic_url;
      sourceSelect.append(option);
    }
    if (state.currentSource) sourceSelect.value = state.currentSource.source_id;
    sourceSelect.disabled = false;
    openSourceButton.disabled = !sourceSelect.value;
  }
  function renderState(state) {
    currentState = state;
    renderSourceSelect(state);
    const imageModeLabels = {
      links: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0438: \u043D\u0435 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u044E\u0442\u0441\u044F, \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0435 URL.",
      all: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0438: \u0441\u043E\u0431\u0438\u0440\u0430\u044E\u0442\u0441\u044F URL \u0432\u0441\u0435\u0445 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0439.",
      keywords: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0438: \u0441\u043E\u0431\u0438\u0440\u0430\u044E\u0442\u0441\u044F URL \u0440\u044F\u0434\u043E\u043C \u0441 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u044B\u043C\u0438 \u0441\u043B\u043E\u0432\u0430\u043C\u0438.",
      manual: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0438: \u0441\u043E\u0431\u0438\u0440\u0430\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0443 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F."
    };
    resetButton.disabled = !state.currentSource;
    pagesInput.value = String(state.settings.maxPages);
    if (state.currentSource) {
      adapterBadge.textContent = state.currentSource.adapter_name;
      adapterBadge.className = "badge";
      sourceInfo.textContent = `${state.currentSource.title} \xB7 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u043F\u043E\u0441\u0442\u043E\u0432: ${state.recentPostCount}`;
      const backgroundItem = state.backgroundCheck?.items.find(
        (item) => item.source_id === state.currentSource?.source_id
      );
      automaticInfo.textContent = state.currentSource.pending_scan_page_url ? "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0435 \u0434\u043E\u0448\u043B\u0430 \u0434\u043E \u0441\u0442\u0430\u0440\u043E\u0439 \u0442\u043E\u0447\u043A\u0438. \u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442 \u044D\u0442\u043E\u0442 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D \u0441\u0430\u043C\u0430." : backgroundItem?.status === "new-likely" ? `\u0424\u043E\u043D\u043E\u0432\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0437\u0430\u043C\u0435\u0442\u0438\u043B\u0430 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u044B\u0435 \u043D\u043E\u0432\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F: ${backgroundItem.message}` : backgroundItem?.status === "blocked" ? `\u0424\u043E\u043D\u043E\u0432\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430: ${backgroundItem.message}` : state.hasCheckpoint ? "\u0412 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0440\u0430\u0437 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u0441\u0430\u043C\u043E \u043D\u0430\u0439\u0434\u0451\u0442 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044E\u044E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u044D\u0442\u043E\u0439 \u0442\u0435\u043C\u044B. \u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0438\u043C\u0435\u043D\u043D\u043E \u0441\u0442\u0430\u0440\u0443\u044E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u043D\u0435 \u043F\u043E\u043D\u0430\u0434\u043E\u0431\u0438\u0442\u0441\u044F." : "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u043F\u043E\u043C\u043D\u0438\u0442\u0435 \u043C\u0435\u0441\u0442\u043E \u0438\u043B\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0445 \u0441\u0442\u0440\u0430\u043D\u0438\u0446.";
      mediaInfo.textContent = imageModeLabels[state.settings.imageMode];
      checkpointBadge.textContent = state.hasCheckpoint ? "\u0442\u043E\u0447\u043A\u0430 \u043E\u0442\u0441\u0447\u0451\u0442\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430" : "\u0442\u043E\u0447\u043A\u0430 \u043E\u0442\u0441\u0447\u0451\u0442\u0430 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0430";
      checkpointBadge.className = `badge ${state.hasCheckpoint ? "" : "neutral"}`;
    } else {
      adapterBadge.textContent = "\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0435\u0449\u0451 \u043D\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D";
      adapterBadge.className = "badge neutral";
      sourceInfo.textContent = "\u041F\u043E\u0441\u043B\u0435 \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C.";
      automaticInfo.textContent = "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043D\u0443\u0436\u043D\u0443\u044E \u0442\u0435\u043C\u0443. \u0414\u0440\u0443\u0433\u0438\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0441\u0430\u0439\u0442\u0430 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u043D\u0435 \u0431\u0443\u0434\u0435\u0442 \u0441\u043E\u0431\u0438\u0440\u0430\u0442\u044C.";
      mediaInfo.textContent = imageModeLabels[state.settings.imageMode];
      checkpointBadge.textContent = "\u0442\u043E\u0447\u043A\u0430 \u043E\u0442\u0441\u0447\u0451\u0442\u0430 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0430";
      checkpointBadge.className = "badge neutral";
    }
    postCount.textContent = state.lastRunAt ? `\u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0437\u0430\u043F\u0443\u0441\u043A: ${new Date(state.lastRunAt).toLocaleString()}` : "\u043D\u0435\u0442 \u0437\u0430\u043F\u0443\u0441\u043A\u0430";
    recentPosts.replaceChildren();
    for (const post of state.recentPosts) {
      const item = document.createElement("div");
      item.className = "recent-post";
      const meta = document.createElement("div");
      meta.className = "post-meta";
      meta.textContent = `${post.author} \xB7 ${post.posted_at || "\u0434\u0430\u0442\u0430 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430"}`;
      const link = document.createElement("a");
      link.href = post.canonical_post_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = post.body_text.slice(0, 150) + (post.body_text.length > 150 ? "\u2026" : "");
      item.append(meta, link);
      recentPosts.append(item);
    }
    renderSavedReports(state.recentReports);
  }
  function renderSavedReports(reports) {
    savedReports.replaceChildren();
    if (reports.length === 0) {
      savedReports.textContent = "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0445 \u043E\u0442\u0432\u0435\u0442\u043E\u0432 \u0418\u0418.";
      return;
    }
    for (const report of reports) {
      const item = document.createElement("div");
      item.className = "saved-report";
      const title = document.createElement("strong");
      title.textContent = report.structured_facts.title || "\u0421\u0432\u043E\u0434\u043A\u0430 \u0431\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F";
      const meta = document.createElement("div");
      meta.className = "post-meta";
      meta.textContent = `${new Date(report.created_at).toLocaleString()} \xB7 Q&A: ${report.qa_entries.length}`;
      const summary = document.createElement("p");
      summary.textContent = report.parsed_summary.slice(0, 500);
      const details = document.createElement("details");
      const caption = document.createElement("summary");
      caption.textContent = "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u043B\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442 \u0418\u0418";
      const fullText = document.createElement("pre");
      fullText.textContent = report.raw_ai_response;
      details.append(caption, fullText);
      item.append(title, meta, summary, details);
      savedReports.append(item);
    }
  }
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} \u0411`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} \u041A\u0411`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} \u041C\u0411`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} \u0413\u0411`;
  }
  async function refreshStorageInfo() {
    if (!navigator.storage?.estimate) {
      const message2 = "\u0414\u0430\u043D\u043D\u044B\u0435 \u0445\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u043D\u0430 \u0434\u0438\u0441\u043A\u0435 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430, \u0430 \u043D\u0435 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E \u0432 \u043E\u043F\u0435\u0440\u0430\u0442\u0438\u0432\u043D\u043E\u0439 \u043F\u0430\u043C\u044F\u0442\u0438.";
      storageInfo.textContent = message2;
      storageFooter.textContent = "\u0420\u0430\u0437\u043C\u0435\u0440 \u0431\u0430\u0437\u044B: \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0432 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435";
      return;
    }
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const message = quota ? `\u0417\u0430\u043D\u044F\u0442\u043E \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u043E ${formatBytes(usage)} \u0438\u0437 ${formatBytes(quota)}. \u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0438 \u0437\u0430\u043D\u0438\u043C\u0430\u044E\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 \u043C\u0435\u0441\u0442\u0430.` : `\u0417\u0430\u043D\u044F\u0442\u043E \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u043E ${formatBytes(usage)} \u043D\u0430 \u0434\u0438\u0441\u043A\u0435 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430.`;
    storageInfo.textContent = `${message} \u042D\u0442\u043E \u043C\u0435\u0441\u0442\u043E \u043D\u0430 \u0434\u0438\u0441\u043A\u0435, \u0430 \u043D\u0435 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u0430\u044F \u043E\u043F\u0435\u0440\u0430\u0442\u0438\u0432\u043D\u0430\u044F \u043F\u0430\u043C\u044F\u0442\u044C.`;
    storageFooter.textContent = `\u0411\u0430\u0437\u0430: ${formatBytes(usage)}`;
  }
  function renderDiagnostics(items) {
    diagnostics.replaceChildren();
    for (const text of items.slice(-30)) {
      const item = document.createElement("li");
      item.textContent = text;
      diagnostics.append(item);
    }
  }
  async function openSelectedSource() {
    if (!sourceSelect.value) return;
    const response = await send({ type: "open-source", sourceId: sourceSelect.value });
    if (!response.ok) setStatus(response.error, "error");
  }
  async function refresh() {
    const response = await send({ type: "get-state", url: activeUrl });
    if (!response.ok) {
      setStatus(response.error, "error");
      return;
    }
    if ("state" in response) renderState(response.state);
    else setStatus("\u0421\u0435\u0440\u0432\u0438\u0441 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442.", "error");
    void refreshStorageInfo().catch(() => void 0);
  }
  async function withBusy(action) {
    if (busy) return void 0;
    busy = true;
    actionButtons.forEach((button) => {
      button.disabled = true;
    });
    try {
      return await action();
    } finally {
      busy = false;
      actionButtons.forEach((button) => {
        button.disabled = false;
      });
    }
  }
  function renderCollection(result) {
    renderDiagnostics(result.diagnostics);
    if (result.protection_message) {
      setStatus(result.protection_message, "warning");
    } else if (!result.ok) {
      setStatus("\u0421\u0431\u043E\u0440 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D: \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0430 \u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u0430 \u0438\u043B\u0438 \u043F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u0430 \u043E\u0448\u0438\u0431\u043A\u0430.", "error");
    } else if (result.mode === "checkpoint") {
      setStatus("Checkpoint \u0441\u043E\u0437\u0434\u0430\u043D. \u0421\u0442\u0430\u0440\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u043D\u0435 \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u044B.", "success");
    } else if (result.stop_reason === "checkpoint-not-found" && result.resume_url && result.posts.length > 0) {
      setStatus(
        `\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0430\u0441\u0442\u044C \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430: ${result.posts.length} \u043D\u043E\u0432\u044B\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043D\u043E\u0432\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F\xBB \u0435\u0449\u0451 \u0440\u0430\u0437 \u2014 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0435\u043D\u0438\u0435 \u043D\u0430\u0447\u043D\u0451\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.`,
        "warning"
      );
    } else if (result.stop_reason === "checkpoint-not-found") {
      setStatus(
        "\u0422\u043E\u0447\u043A\u0430 \u043E\u0442\u0441\u0447\u0451\u0442\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0432 \u0437\u0430\u0434\u0430\u043D\u043D\u043E\u043C \u043B\u0438\u043C\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446. \u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043E\u0442\u043C\u0435\u0442\u0438\u043B\u043E \u043A\u0430\u043A \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0435.",
        "warning"
      );
    } else {
      setStatus(`\u0413\u043E\u0442\u043E\u0432\u043E: \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u043D\u043E\u0432\u044B\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 ${result.posts.length}.`, "success");
    }
  }
  async function downloadDiagnostic() {
    await withBusy(async () => {
      diagnosticStatus.textContent = "\u0421\u043E\u0431\u0438\u0440\u0430\u044E \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0443 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B\u2026";
      const response = await send({ type: "run-diagnostic", url: activeUrl });
      if (!response.ok) {
        diagnosticStatus.textContent = response.error;
        setStatus(response.error, "error");
        return;
      }
      if (!("diagnostic" in response)) {
        diagnosticStatus.textContent = "\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u0432\u0435\u0440\u043D\u0443\u043B\u043E \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442.";
        return;
      }
      diagnosticPreview.value = response.diagnostic.markdown;
      downloadText("diagnostic.md", response.diagnostic.markdown, "text/markdown;charset=utf-8");
      downloadText("diagnostic.json", response.diagnostic.json, "application/json;charset=utf-8");
      diagnosticStatus.textContent = "\u0413\u043E\u0442\u043E\u0432\u043E: \u0441\u043A\u0430\u0447\u0430\u043D\u044B fkb-diagnostic.md \u0438 fkb-diagnostic.json. \u041F\u0440\u0438\u0448\u043B\u0438\u0442\u0435 \u0438\u0445 \u043C\u043D\u0435 \u0438\u043B\u0438 \u0432\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435.";
      setStatus("\u0414\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043B\u043E\u0433 \u0441\u043A\u0430\u0447\u0430\u043D.", "success");
    });
  }
  async function cleanCurrentSource() {
    if (!activeUrl || !confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u044F\u0432\u043D\u043E \u043D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u044B\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u043C\u0435\u043D\u044E? \u0422\u043E\u0447\u043A\u0430 \u043E\u0442\u0441\u0447\u0451\u0442\u0430 \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F.")) return;
    await withBusy(async () => {
      const response = await send({ type: "clean-service-posts", url: activeUrl });
      if (!response.ok) {
        setStatus(response.error, "error");
        return;
      }
      setStatus("message" in response ? response.message : "\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u044B\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u044B.", "success");
      await refresh();
    });
  }
  async function resetCurrentSource() {
    if (!activeUrl || !confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u043F\u043E\u0441\u0442\u044B \u0438 \u0442\u043E\u0447\u043A\u0443 \u043E\u0442\u0441\u0447\u0451\u0442\u0430 \u044D\u0442\u043E\u0439 \u0442\u0435\u043C\u044B? \u041E\u0442\u0447\u0451\u0442\u044B \u0418\u0418 \u043E\u0441\u0442\u0430\u043D\u0443\u0442\u0441\u044F.")) return;
    await withBusy(async () => {
      const response = await send({ type: "reset-source", url: activeUrl });
      if (!response.ok) {
        setStatus(response.error, "error");
        return;
      }
      setStatus("\u0414\u0430\u043D\u043D\u044B\u0435 \u0442\u0435\u043C\u044B \u0443\u0434\u0430\u043B\u0435\u043D\u044B. \u0422\u0435\u043F\u0435\u0440\u044C \u043C\u043E\u0436\u043D\u043E \u0437\u0430\u043D\u043E\u0432\u043E \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0442\u043E\u0447\u043A\u0443 \u043E\u0442\u0441\u0447\u0451\u0442\u0430 \u0438\u043B\u0438 \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0438\u0441\u0442\u043E\u0440\u0438\u044E.", "success");
      await refresh();
    });
  }
  async function collect(mode) {
    await withBusy(async () => {
      setStatus(mode === "new" ? "\u0418\u0434\u0451\u0442 \u043F\u043E\u0438\u0441\u043A checkpoint \u0438 \u043D\u043E\u0432\u044B\u0445 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u2026" : "\u0418\u0434\u0451\u0442 \u0440\u0430\u0437\u0431\u043E\u0440 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B\u2026", "neutral");
      const response = await send({ type: "collect", mode, url: activeUrl, maxPages: Number(pagesInput.value) });
      if (!response.ok) {
        setStatus(response.error, "error");
        renderDiagnostics(response.details || []);
        return;
      }
      if ("collection" in response) renderCollection(response.collection);
      else setStatus("\u0421\u0435\u0440\u0432\u0438\u0441 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442.", "error");
      await refresh();
    });
  }
  async function createPackage(mode) {
    await withBusy(async () => {
      setStatus(mode === "single" ? "\u0424\u043E\u0440\u043C\u0438\u0440\u0443\u044E \u0435\u0434\u0438\u043D\u044B\u0439 \u0444\u0430\u0439\u043B \u0434\u043B\u044F \u0418\u0418\u2026" : "\u0420\u0430\u0437\u0434\u0435\u043B\u044F\u044E \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u043F\u0430\u043A\u0435\u0442 \u043D\u0430 \u0447\u0430\u0441\u0442\u0438\u2026", "neutral");
      const response = await send({ type: "create-package", mode });
      if (!response.ok) {
        packageStatus.textContent = response.error;
        setStatus(response.error, "warning");
        return;
      }
      if (mode === "single") {
        if (!("singlePacket" in response)) {
          setStatus("\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u0432\u0435\u0440\u043D\u0443\u043B\u043E \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442.", "error");
          return;
        }
        const selectedFormats = formatCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
        if (selectedFormats.length === 0) {
          setStatus("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u0438\u043D \u0444\u043E\u0440\u043C\u0430\u0442 \u0444\u0430\u0439\u043B\u0430.", "warning");
          return;
        }
        const packet = response.singlePacket;
        const files2 = {
          md: ["ai-full.md", packet.markdown, "text/markdown;charset=utf-8"],
          json: ["ai-full.json", packet.json, "application/json;charset=utf-8"],
          txt: ["ai-full.txt", packet.text, "text/plain;charset=utf-8"]
        };
        promptPreview.value = packet.markdown;
        copyButton.textContent = "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432\u0435\u0441\u044C prompt";
        packageStatus.textContent = `${selectedFormats.length} \u0435\u0434\u0438\u043D\u044B\u0439 \u0444\u0430\u0439\u043B(\u0430) \u0433\u043E\u0442\u043E\u0432\u044B: ${packet.post_count} \u043D\u043E\u0432\u044B\u0445 \u043F\u043E\u0441\u0442\u043E\u0432 \u0438 ${packet.context_count} \u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0445 \u0441\u0442\u0430\u0440\u044B\u0445.`;
        for (const format of selectedFormats) {
          const file = files2[format];
          downloadText(file[0], file[1], file[2]);
        }
        setStatus("\u0415\u0434\u0438\u043D\u044B\u0439 \u0444\u0430\u0439\u043B \u0433\u043E\u0442\u043E\u0432. \u0412 \u043D\u0451\u043C \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u043F\u0440\u043E\u043C\u043F\u0442 \u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F \u043F\u043E \u0444\u043E\u0440\u043C\u0430\u0442\u0443 \u043E\u0442\u0432\u0435\u0442\u0430.", "success");
        return;
      }
      if (!("packet" in response)) {
        setStatus("\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u0432\u0435\u0440\u043D\u0443\u043B\u043E \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442.", "error");
        return;
      }
      const chunks = response.packet.chunks;
      const firstChunk = chunks[0];
      if (!firstChunk) {
        setStatus("\u041F\u0430\u043A\u0435\u0442 \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0447\u0430\u0441\u0442\u0435\u0439 \u0434\u043B\u044F \u0430\u043D\u0430\u043B\u0438\u0437\u0430.", "error");
        return;
      }
      copyButton.textContent = chunks.length === 1 ? "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432\u0435\u0441\u044C prompt" : "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u0435\u0440\u0432\u0443\u044E \u0447\u0430\u0441\u0442\u044C";
      promptPreview.value = chunks.length === 1 ? firstChunk.prompt_md : `\u041F\u0430\u043A\u0435\u0442 \u0440\u0430\u0437\u0434\u0435\u043B\u0451\u043D \u043D\u0430 ${chunks.length} \u0447\u0430\u0441\u0442\u0435\u0439. \u041D\u0438\u0436\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0430 \u0447\u0430\u0441\u0442\u044C 1. \u041E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u0418\u0418 \u043A\u0430\u0436\u0434\u044B\u0439 \u0441\u043A\u0430\u0447\u0430\u043D\u043D\u044B\u0439 prompt \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E.

${firstChunk.prompt_md}`;
      packageStatus.textContent = `${response.packet.total_post_count} \u043D\u043E\u0432\u044B\u0445 \u043F\u043E\u0441\u0442\u043E\u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435\u043D\u044B \u043D\u0430 ${chunks.length} \u0447\u0430\u0441\u0442\u0435\u0439; prompts \u0438 ZIP \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u043D\u0438\u0436\u0435.`;
      const files = [];
      for (const chunk of chunks) {
        const number = String(chunk.part_number).padStart(2, "0");
        const total = String(chunk.part_count).padStart(2, "0");
        files.push(
          [`prompt-${number}-of-${total}.md`, chunk.prompt_md, "text/markdown;charset=utf-8"],
          [`posts-${number}-of-${total}.json`, chunk.posts_json, "application/json;charset=utf-8"],
          [`context-posts-${number}-of-${total}.json`, chunk.context_posts_json, "application/json;charset=utf-8"],
          [`links-${number}-of-${total}.json`, chunk.links_json, "application/json;charset=utf-8"],
          [`manifest-${number}-of-${total}.json`, chunk.manifest_json, "application/json;charset=utf-8"]
        );
        downloadText(`prompt-${number}-of-${total}.md`, chunk.prompt_md, "text/markdown;charset=utf-8");
      }
      files.push(["combine-prompt.md", response.packet.combine_prompt_md, "text/markdown;charset=utf-8"]);
      files.push(["full-posts.txt", response.packet.full_text, "text/plain;charset=utf-8"]);
      downloadText("combine-prompt.md", response.packet.combine_prompt_md, "text/markdown;charset=utf-8");
      downloadText("full-posts.txt", response.packet.full_text, "text/plain;charset=utf-8");
      const archive = zipSync(Object.fromEntries(files.map(([name, contents]) => [name, strToU8(contents)])));
      downloadBytes("package.zip", archive, "application/zip");
      setStatus(
        chunks.length === 1 ? "\u041F\u0430\u043A\u0435\u0442 \u0433\u043E\u0442\u043E\u0432. \u041C\u043E\u0436\u043D\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C prompt \u0438\u0437 \u043F\u0435\u0440\u0432\u043E\u0439 \u0447\u0430\u0441\u0442\u0438 \u0438\u043B\u0438 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u0435\u0434\u0438\u043D\u044B\u0439 \u0444\u0430\u0439\u043B." : "\u041F\u0430\u043A\u0435\u0442 \u0433\u043E\u0442\u043E\u0432. \u041E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u0418\u0418 prompts \u043F\u043E \u043E\u0447\u0435\u0440\u0435\u0434\u0438, \u0437\u0430\u0442\u0435\u043C \u0432\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043E\u0442\u0432\u0435\u0442\u044B \u0432 combine-prompt.md \u0438 \u043F\u043E\u043F\u0440\u043E\u0441\u0438\u0442\u0435 \u0418\u0418 \u0441\u0434\u0435\u043B\u0430\u0442\u044C \u0438\u0442\u043E\u0433\u043E\u0432\u0443\u044E \u0441\u0432\u043E\u0434\u043A\u0443.",
        "success"
      );
    });
  }
  function downloadText(name, contents, type) {
    downloadBytes(name, new TextEncoder().encode(contents), type);
  }
  function downloadBytes(name, bytes, type) {
    const blob = new Blob([bytes.buffer], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fkb-${name}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  async function exportLocal() {
    await withBusy(async () => {
      setStatus("\u042D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u0443\u044E \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435\u2026", "neutral");
      const response = await send({ type: "export-local" });
      if (!response.ok) {
        setStatus(response.error, "error");
        return;
      }
      if (!("exportData" in response)) {
        setStatus("\u0421\u0435\u0440\u0432\u0438\u0441 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442.", "error");
        return;
      }
      downloadText("local-export.json", response.exportData.json, "application/json;charset=utf-8");
      downloadText("local-export.md", response.exportData.markdown, "text/markdown;charset=utf-8");
      setStatus("\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u0431\u0430\u0437\u0430 \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u0432 JSON \u0438 Markdown.", "success");
    });
  }
  async function searchLocal() {
    const query = localSearch.value.trim();
    const response = await send({ type: "search-local", query });
    if (!response.ok) {
      localSearchResult.textContent = response.error;
      return;
    }
    if (!("search" in response)) {
      localSearchResult.textContent = "\u0421\u0435\u0440\u0432\u0438\u0441 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442.";
      return;
    }
    const { posts, reports, qa } = response.search;
    localSearchResult.replaceChildren();
    const summary = document.createElement("p");
    summary.textContent = `\u041D\u0430\u0439\u0434\u0435\u043D\u043E \u043F\u043E\u0441\u0442\u043E\u0432: ${posts.length}; Q&A: ${qa.length}; \u0441\u0432\u043E\u0434\u043E\u043A: ${reports.length}.`;
    localSearchResult.append(summary);
    for (const post of posts.slice(0, 8)) {
      const item = document.createElement("div");
      item.className = "recent-post";
      const link = document.createElement("a");
      link.href = post.canonical_post_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${post.author}: ${post.body_text.slice(0, 160)}`;
      item.append(link);
      localSearchResult.append(item);
    }
    for (const entry of qa.slice(0, 8)) {
      const item = document.createElement("div");
      item.className = "recent-post";
      item.textContent = `Q&A [${entry.status}]: ${entry.question} \u2014 ${entry.short_answer}`;
      localSearchResult.append(item);
    }
    for (const report of reports.slice(0, 5)) {
      const item = document.createElement("div");
      item.className = "recent-post";
      item.textContent = `\u0421\u0432\u043E\u0434\u043A\u0430: ${report.parsed_summary.slice(0, 180)}`;
      localSearchResult.append(item);
    }
  }
  async function importResponse() {
    const raw = aiResponse.value.trim();
    if (!raw) {
      setStatus("\u0412\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043E\u0442\u0432\u0435\u0442 \u0418\u0418 \u0438\u043B\u0438 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0430\u0439\u043B.", "warning");
      return;
    }
    await withBusy(async () => {
      const sourceId = currentState?.currentSource?.source_id;
      const topicId = currentState?.currentSource ? parseTopicId(currentState.currentSource.topic_url) : void 0;
      const request = { type: "import-ai", raw };
      if (sourceId) request.sourceId = sourceId;
      if (topicId) request.topicId = topicId;
      const response = await send(request);
      if (!response.ok) {
        setStatus(response.error, "error");
        return;
      }
      if (!("importResult" in response)) {
        setStatus("\u0421\u0435\u0440\u0432\u0438\u0441 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442.", "error");
        return;
      }
      const result = response.importResult;
      importResult.replaceChildren();
      const summary = document.createElement("p");
      summary.textContent = result.valid_json ? `\u0412\u0430\u043B\u0438\u0434\u043D\u044B\u0439 JSON \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D. Q&A-\u043A\u0430\u0440\u0442\u043E\u0447\u0435\u043A: ${result.report.qa_entries.length}.` : `\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430 Markdown-\u0441\u0432\u043E\u0434\u043A\u0430. \u0420\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u043E Q&A: ${result.report.qa_entries.length}.`;
      importResult.append(summary);
      if (result.warnings.length || result.unrecognized_qa.length) {
        const list = document.createElement("ul");
        [...result.warnings, ...result.unrecognized_qa.map((item) => `Q&A \u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u0430: ${item}`)].forEach((warning) => {
          const item = document.createElement("li");
          item.textContent = warning;
          list.append(item);
        });
        importResult.append(list);
      }
      setStatus("\u041E\u0442\u0432\u0435\u0442 \u0418\u0418 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E.", result.valid_json ? "success" : "warning");
      await refresh();
      const reportsPanel = savedReports.closest("details");
      if (reportsPanel) reportsPanel.open = true;
    });
  }
  responseFile.addEventListener("change", () => {
    const file = responseFile.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      aiResponse.value = text;
    });
  });
  $("#cleanButton").addEventListener("click", () => void cleanCurrentSource());
  $("#diagnosticButton").addEventListener("click", () => void downloadDiagnostic());
  $("#resetButton").addEventListener("click", () => void resetCurrentSource());
  $("#checkpointButton").addEventListener("click", () => void collect("checkpoint"));
  $("#historyButton").addEventListener("click", () => void collect("history"));
  $("#collectButton").addEventListener("click", () => void collect("new"));
  $("#packageButton").addEventListener("click", () => void createPackage("single"));
  splitPackageButton.addEventListener("click", () => void createPackage("split"));
  $("#exportButton").addEventListener("click", () => void exportLocal());
  localSearchButton.addEventListener("click", () => void searchLocal());
  localSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") void searchLocal();
  });
  $("#importButton").addEventListener("click", () => void importResponse());
  $("#refreshButton").addEventListener("click", () => void refresh());
  $("#settingsButton").addEventListener("click", () => void send({ type: "open-options" }));
  $("#settingsTextButton").addEventListener("click", () => void send({ type: "open-options" }));
  sourceSelect.addEventListener("change", () => {
    openSourceButton.disabled = !sourceSelect.value;
  });
  openSourceButton.addEventListener("click", () => void openSelectedSource());
  $("#copyButton").addEventListener("click", async () => {
    if (!promptPreview.value) return;
    await navigator.clipboard.writeText(promptPreview.value);
    packageStatus.textContent = "prompt \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D \u0432 \u0431\u0443\u0444\u0435\u0440 \u043E\u0431\u043C\u0435\u043D\u0430.";
  });
  void (async () => {
    try {
      versionInfo.textContent = `\u0412\u0435\u0440\u0441\u0438\u044F ${chrome.runtime.getManifest().version}`;
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      activeUrl = tabs[0]?.url || "";
      currentUrl.textContent = activeUrl || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C URL \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0439 \u0432\u043A\u043B\u0430\u0434\u043A\u0438.";
      copyButton.disabled = !activeUrl;
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), "error");
    }
  })();
})();
