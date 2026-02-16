#version 300 es
precision highp float;

const int MAX_STEPS = 40;
const float EPS = 1e-6;
const float PI = 3.141592653589793;

uniform sampler2D u_image;
uniform vec2 u_imageHalf;
uniform vec2 u_resolution;
uniform int u_stepCount;
uniform int u_prefixCount;
uniform int u_types[MAX_STEPS];
uniform vec4 u_data1[MAX_STEPS];
uniform vec4 u_data2[MAX_STEPS];
uniform vec4 u_data3[MAX_STEPS];
uniform int u_mode;
uniform float u_alpha;

in vec2 v_uv;
out vec4 outColor;

vec2 complexMul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 complexDiv(vec2 a, vec2 b, out bool ok) {
  float denom = dot(b, b);
  if (denom < EPS) {
    ok = false;
    return vec2(0.0);
  }
  ok = true;
  return vec2(
    (a.x * b.x + a.y * b.y) / denom,
    (a.y * b.x - a.x * b.y) / denom
  );
}

vec2 applyStep(int idx, vec2 z, out bool ok) {
  int kind = u_types[idx];
  ok = true;

  if (kind == 0) {
    return z;
  }

  if (kind == 1) {
    vec4 m = u_data1[idx];
    return vec2(m.x * z.x + m.y * z.y, m.z * z.x + m.w * z.y);
  }

  if (kind == 2) {
    vec4 m = u_data1[idx];
    vec4 t = u_data2[idx];
    return vec2(m.x * z.x + m.y * z.y + t.x, m.z * z.x + m.w * z.y + t.y);
  }

  if (kind == 3) {
    vec4 d1 = u_data1[idx];
    vec4 d2 = u_data2[idx];
    vec4 d3 = u_data3[idx];

    float x = d1.x * z.x + d1.y * z.y + d1.z;
    float y = d1.w * z.x + d2.x * z.y + d2.y;
    float w = d2.z * z.x + d2.w * z.y + d3.x;

    if (abs(w) < EPS) {
      ok = false;
      return vec2(0.0);
    }

    return vec2(x / w, y / w);
  }

  if (kind == 4 || kind == 5) {
    vec4 p1 = u_data1[idx];
    vec4 p2 = u_data2[idx];
    vec2 a = vec2(p1.x, p1.y);
    vec2 b = vec2(p1.z, p1.w);
    vec2 c = vec2(p2.x, p2.y);
    vec2 d = vec2(p2.z, p2.w);

    vec2 inputZ = z;
    if (kind == 5) {
      inputZ = vec2(z.x, -z.y);
    }

    vec2 num = complexMul(a, inputZ) + b;
    vec2 den = complexMul(c, inputZ) + d;
    return complexDiv(num, den, ok);
  }

  if (kind == 6) {
    float r = u_data1[idx].x;
    float r2 = r * r;
    float denom = dot(z, z);
    if (denom < EPS) {
      ok = false;
      return vec2(0.0);
    }
    return (r2 / denom) * z;
  }

  return z;
}

vec3 mapPoint(vec2 point, int prefixCount) {
  vec2 z = point;

  // Runtime steps are stored in forward chronological order, so for inverse mapping
  // we apply their inverse maps in reverse order.
  for (int i = MAX_STEPS - 1; i >= 0; i -= 1) {
    if (i >= u_stepCount || i >= prefixCount) {
      continue;
    }
    bool ok;
    z = applyStep(i, z, ok);
    if (!ok || any(isnan(z))) {
      return vec3(0.0, 0.0, -1.0);
    }
  }

  return vec3(z, 1.0);
}

float squareGridAlpha(vec2 z) {
  float spacing = 0.2;
  float thickness = 1.2 / min(u_resolution.x, u_resolution.y) * 2.0;

  float dx = abs(fract(z.x / spacing + 0.5) - 0.5) * spacing;
  float dy = abs(fract(z.y / spacing + 0.5) - 0.5) * spacing;
  float line = min(dx, dy);

  return smoothstep(thickness, 0.0, line);
}

float polarGridAlpha(vec2 z) {
  float radialSpacing = 0.2;
  float angleSpacing = PI / 12.0;
  float thickness = 1.2 / min(u_resolution.x, u_resolution.y) * 2.0;

  float r = length(z);
  float angle = atan(z.y, z.x);

  float dr = abs(fract(r / radialSpacing + 0.5) - 0.5) * radialSpacing;
  float da = abs(mod(angle + angleSpacing * 0.5, angleSpacing) - angleSpacing * 0.5);
  float arc = da * max(r, 0.1);

  float line = min(dr, arc);
  return smoothstep(thickness, 0.0, line);
}

void main() {
  vec2 world = vec2((v_uv.x - 0.5) * 2.0, (0.5 - v_uv.y) * 2.0);
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  if (aspect >= 1.0) {
    world.x *= aspect;
  } else {
    world.y /= aspect;
  }
  world *= 2.0;

  int prefix = (u_mode == 0) ? u_prefixCount : u_stepCount;
  vec3 mapped = mapPoint(world, prefix);
  if (mapped.z < 0.0) {
    outColor = vec4(0.0);
    return;
  }

  vec2 source = mapped.xy;

  if (u_mode == 0) {
    vec2 uv = vec2(
      source.x / (2.0 * u_imageHalf.x) + 0.5,
      0.5 - source.y / (2.0 * u_imageHalf.y)
    );

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      outColor = vec4(0.0);
      return;
    }

    vec4 tex = texture(u_image, uv);
    outColor = vec4(tex.rgb, tex.a * u_alpha);
    return;
  }

  if (u_mode == 1) {
    float a = squareGridAlpha(source) * u_alpha;
    outColor = vec4(0.08, 0.41, 0.44, a);
    return;
  }

  float p = polarGridAlpha(source) * u_alpha;
  outColor = vec4(0.79, 0.36, 0.13, p);
}
