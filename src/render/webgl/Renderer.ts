import type { EditorSource, RuntimeStep } from '../../types/transforms';
import { MAX_STEPS } from '../../types/transforms';
import vertexSource from './shaders/warp.vert.glsl?raw';
import fragmentSource from './shaders/warp.frag.glsl?raw';

interface RenderOptions {
  source: EditorSource | null;
  steps: RuntimeStep[];
  showFirstImage: boolean;
  visibleSteps: boolean[];
  showSquareGrid: boolean;
  showPolarGrid: boolean;
}

interface Uniforms {
  image: WebGLUniformLocation;
  imageHalf: WebGLUniformLocation;
  resolution: WebGLUniformLocation;
  stepCount: WebGLUniformLocation;
  prefixCount: WebGLUniformLocation;
  types: WebGLUniformLocation;
  data1: WebGLUniformLocation;
  data2: WebGLUniformLocation;
  data3: WebGLUniformLocation;
  mode: WebGLUniformLocation;
  alpha: WebGLUniformLocation;
  mirrorX: WebGLUniformLocation;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Unable to allocate shader');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed: ${error}`);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string,
): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertex);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragment);

  const program = gl.createProgram();
  if (!program) {
    throw new Error('Unable to allocate WebGL program');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${error}`);
  }

  return program;
}

function requireLocation(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) {
    throw new Error(`Missing uniform: ${name}`);
  }
  return location;
}

export class Renderer {
  private canvas: HTMLCanvasElement;

  private gl: WebGL2RenderingContext;

  private program: WebGLProgram;

  private vao: WebGLVertexArrayObject;

  private uniforms: Uniforms;

  private texture: WebGLTexture | null = null;

  private lastBitmap: ImageBitmap | null = null;

  private imageHalf: [number, number] = [0.8, 0.8];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
    if (!gl) {
      throw new Error('WebGL2 is not supported in this browser.');
    }

    this.gl = gl;
    this.program = createProgram(gl, vertexSource, fragmentSource);

    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Unable to allocate vertex array object');
    }
    this.vao = vao;

    gl.bindVertexArray(this.vao);

    const quad = gl.createBuffer();
    if (!quad) {
      throw new Error('Unable to allocate quad vertex buffer');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    gl.useProgram(this.program);

    this.uniforms = {
      image: requireLocation(gl, this.program, 'u_image'),
      imageHalf: requireLocation(gl, this.program, 'u_imageHalf'),
      resolution: requireLocation(gl, this.program, 'u_resolution'),
      stepCount: requireLocation(gl, this.program, 'u_stepCount'),
      prefixCount: requireLocation(gl, this.program, 'u_prefixCount'),
      types: requireLocation(gl, this.program, 'u_types[0]'),
      data1: requireLocation(gl, this.program, 'u_data1[0]'),
      data2: requireLocation(gl, this.program, 'u_data2[0]'),
      data3: requireLocation(gl, this.program, 'u_data3[0]'),
      mode: requireLocation(gl, this.program, 'u_mode'),
      alpha: requireLocation(gl, this.program, 'u_alpha'),
      mirrorX: requireLocation(gl, this.program, 'u_mirrorX'),
    };

    gl.uniform1i(this.uniforms.image, 0);
    gl.uniform1i(this.uniforms.mirrorX, 0);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  private ensureCanvasSize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const displayWidth = Math.floor(this.canvas.clientWidth * dpr);
    const displayHeight = Math.floor(this.canvas.clientHeight * dpr);

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }
  }

  private updateTexture(source: EditorSource | null) {
    if (!source) {
      return;
    }

    const gl = this.gl;

    if (!this.texture) {
      this.texture = gl.createTexture();
    }

    if (!this.texture) {
      return;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    if (source.kind === 'upload') {
      if (this.lastBitmap !== source.bitmap) {
        this.lastBitmap = source.bitmap;
        // Fragment shader already handles y-axis orientation for world->texture mapping.
        // Flipping again during upload inverts imported images.
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source.bitmap);
      }
    } else {
      this.lastBitmap = null;
      if (source.video.readyState < 2) {
        return;
      }
      // Video/HTML media sources are top-left origin; flip at upload so shader-space y-up mapping
      // matches uploaded-image behavior.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source.video);
    }

    const maxHalf = 0.82;
    const aspect = source.width / source.height;
    if (aspect >= 1) {
      this.imageHalf = [maxHalf, maxHalf / aspect];
    } else {
      this.imageHalf = [maxHalf * aspect, maxHalf];
    }
  }

  private uploadStepUniforms(steps: RuntimeStep[]) {
    const gl = this.gl;
    const types = new Int32Array(MAX_STEPS);
    const data1 = new Float32Array(MAX_STEPS * 4);
    const data2 = new Float32Array(MAX_STEPS * 4);
    const data3 = new Float32Array(MAX_STEPS * 4);

    for (let i = 0; i < Math.min(steps.length, MAX_STEPS); i += 1) {
      const step = steps[i];
      types[i] = step.type;
      data1.set(step.data1, i * 4);
      data2.set(step.data2, i * 4);
      data3.set(step.data3, i * 4);
    }

    gl.uniform1iv(this.uniforms.types, types);
    gl.uniform4fv(this.uniforms.data1, data1);
    gl.uniform4fv(this.uniforms.data2, data2);
    gl.uniform4fv(this.uniforms.data3, data3);
    gl.uniform1i(this.uniforms.stepCount, Math.min(steps.length, MAX_STEPS));
  }

  private drawStage(prefixCount: number, alpha: number, mode: 0 | 1 | 2) {
    const gl = this.gl;
    gl.uniform1i(this.uniforms.mode, mode);
    gl.uniform1i(this.uniforms.prefixCount, prefixCount);
    gl.uniform1f(this.uniforms.alpha, alpha);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  render(options: RenderOptions) {
    const gl = this.gl;

    this.ensureCanvasSize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    this.updateTexture(options.source);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.clearColor(0.94, 0.95, 0.93, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform2f(this.uniforms.imageHalf, this.imageHalf[0], this.imageHalf[1]);
    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);

    const steps = options.steps.slice(0, MAX_STEPS);
    const stepCount = steps.length;
    this.uploadStepUniforms(steps);

    const mirrorX = options.source?.kind === 'camera' && options.source.mirrorPreview;
    gl.uniform1i(this.uniforms.mirrorX, mirrorX ? 1 : 0);

    if (this.texture && options.source) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);

      if (stepCount === 0) {
        if (options.showFirstImage) {
          this.drawStage(0, 1, 0);
        }
      } else {
        if (options.showFirstImage) {
          this.drawStage(0, 0.45, 0);
        }

        if (stepCount > 1) {
          const intermediate = stepCount - 1;
          for (let i = 1; i < stepCount; i += 1) {
            if (!options.visibleSteps[i - 1]) {
              continue;
            }
            const t = intermediate === 0 ? 1 : i / intermediate;
            const alpha = 0.18 + t * (0.72 - 0.18);
            this.drawStage(i, alpha, 0);
          }
        }

        if (options.visibleSteps[stepCount - 1]) {
          this.drawStage(stepCount, 1, 0);
        }
      }
    }

    if (options.showSquareGrid) {
      this.drawStage(stepCount, 0.68, 1);
    }

    if (options.showPolarGrid) {
      this.drawStage(stepCount, 0.62, 2);
    }

    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    if (this.texture) {
      gl.deleteTexture(this.texture);
      this.texture = null;
    }

    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }
}
