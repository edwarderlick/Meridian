import { useEffect, useRef, useState } from 'react'
import { usePointerCapable } from '../hooks/usePointerCapable'

const VERTEX_SHADER = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

const FRAGMENT_SHADER = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_mouseInfluence;

void main() {
    vec2 uv = v_texCoord;

    // Create organic movement
    float n = sin(uv.x * 3.0 + u_time * 0.5) * 0.5 + 0.5;
    float m = cos(uv.y * 2.0 - u_time * 0.3) * 0.5 + 0.5;

    // Arc network inspired colors (Pink, Purple, Deep Blue)
    vec3 color1 = vec3(0.88, 0.08, 0.90); // Vibrant Pink
    vec3 color2 = vec3(0.40, 0.15, 0.95); // Royal Purple
    vec3 color3 = vec3(0.05, 0.05, 0.15); // Deep Obsidian

    // Flowing gradient wave logic
    float wave = sin(uv.x * 4.0 + u_time * 0.2) * 0.1;
    float line = smoothstep(0.4 + wave, 0.41 + wave, uv.y) - smoothstep(0.44 + wave, 0.45 + wave, uv.y);

    vec3 bg = mix(color3, color2 * 0.2, uv.y);
    vec3 gradient = mix(color1, color2, n * m);

    vec3 finalColor = mix(bg, gradient, line * 0.6);

    // Add some subtle glow
    finalColor += gradient * (0.05 / distance(uv.y, 0.43 + wave));

    // Gentle cursor-reactive glow (pointer devices only, degrades to 0 on touch)
    vec2 mouseUV = u_mouse / u_resolution;
    float mouseDist = distance(uv, mouseUV);
    float mouseGlow = u_mouseInfluence * smoothstep(0.45, 0.0, mouseDist) * 0.12;
    finalColor += color1 * mouseGlow;

    gl_FragColor = vec4(finalColor, 1.0);
}`

export default function ShaderBackground({ fade = 1 }: { fade?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)
  const pointerCapable = usePointerCapable()
  const pointerCapableRef = useRef(pointerCapable)
  pointerCapableRef.current = pointerCapable

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const syncSize = () => {
      const w = canvas.clientWidth || 1280
      const h = canvas.clientHeight || 720
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }

    let resizeObserver: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(syncSize)
      resizeObserver.observe(canvas)
    }
    syncSize()

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return

    const glContext = gl as WebGLRenderingContext

    const compileShader = (type: number, src: string) => {
      const shader = glContext.createShader(type)!
      glContext.shaderSource(shader, src)
      glContext.compileShader(shader)
      return shader
    }

    const prog = glContext.createProgram()!
    glContext.attachShader(prog, compileShader(glContext.VERTEX_SHADER, VERTEX_SHADER))
    glContext.attachShader(prog, compileShader(glContext.FRAGMENT_SHADER, FRAGMENT_SHADER))
    glContext.linkProgram(prog)
    glContext.useProgram(prog)

    const buf = glContext.createBuffer()
    glContext.bindBuffer(glContext.ARRAY_BUFFER, buf)
    glContext.bufferData(
      glContext.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      glContext.STATIC_DRAW,
    )
    const posLoc = glContext.getAttribLocation(prog, 'a_position')
    glContext.enableVertexAttribArray(posLoc)
    glContext.vertexAttribPointer(posLoc, 2, glContext.FLOAT, false, 0, 0)

    const uTime = glContext.getUniformLocation(prog, 'u_time')
    const uRes = glContext.getUniformLocation(prog, 'u_resolution')
    const uMouse = glContext.getUniformLocation(prog, 'u_mouse')
    const uMouseInfluence = glContext.getUniformLocation(prog, 'u_mouseInfluence')

    // u_mouse is in pixel coordinates matching u_resolution (ShaderToy convention).
    const mouse = { x: canvas.width / 2, y: canvas.height / 2 }
    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width && rect.height) {
        const nx = (event.clientX - rect.left) / rect.width
        const ny = 1.0 - (event.clientY - rect.top) / rect.height
        mouse.x = nx * canvas.width
        mouse.y = ny * canvas.height
      }
    }

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let rafId = 0
    let firstFrame = true
    const render = (t: number) => {
      if (typeof ResizeObserver === 'undefined') syncSize()
      glContext.viewport(0, 0, canvas.width, canvas.height)
      if (uTime) glContext.uniform1f(uTime, t * 0.001)
      if (uRes) glContext.uniform2f(uRes, canvas.width, canvas.height)
      if (uMouse) glContext.uniform2f(uMouse, mouse.x, mouse.y)
      if (uMouseInfluence) glContext.uniform1f(uMouseInfluence, pointerCapableRef.current ? 1 : 0)
      glContext.drawArrays(glContext.TRIANGLE_STRIP, 0, 4)
      if (firstFrame) {
        firstFrame = false
        setReady(true)
      }
      if (!prefersReducedMotion) rafId = requestAnimationFrame(render)
    }

    if (prefersReducedMotion) {
      // Respect prefers-reduced-motion: paint a single static frame instead of animating.
      render(0)
    } else {
      rafId = requestAnimationFrame(render)
      window.addEventListener('mousemove', handleMouseMove)
    }

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', handleMouseMove)
      resizeObserver?.disconnect()
    }
  }, [])

  return (
    <div className="absolute inset-0 w-full h-full" style={{ opacity: 0.4 * fade }}>
      <canvas
        ref={canvasRef}
        className="transition-opacity duration-700 ease-out"
        style={{ display: 'block', width: '100%', height: '100%', opacity: ready ? 1 : 0 }}
      />
    </div>
  )
}
