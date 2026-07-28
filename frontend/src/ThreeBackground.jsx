import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * ThreeBackground — an ambient, code-native WebGL backdrop.
 *
 * Framewright rules applied:
 *  - Ambient life belongs ONLY to backgrounds, and even there it is slow.
 *  - Code-native visuals over stock/AI plates (no sonar rings, no blobs).
 *  - Colour carries meaning: one structural ink + one lime accent, nothing else.
 *
 * A slowly drifting low-poly icosahedron wireframe with a soft glowing core and
 * a sparse particle field. Fixed behind all content, non-interactive, low opacity.
 * Honours prefers-reduced-motion (renders a single still frame, no RAF loop).
 */
export default function ThreeBackground({ accent = '#D97757' }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // Bail gracefully if WebGL is unavailable
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
    } catch {
      return
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const accentColor = new THREE.Color(accent)

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x14110f, 0.055) // warm smoke

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100)
    camera.position.set(0, 0, 9)

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    // --- Wireframe hero: low-poly icosahedron ----------------------------
    const icoGeo = new THREE.IcosahedronGeometry(2.7, 1)
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(icoGeo),
      new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0.07 })
    )

    // Faint solid shell for depth (dark, barely-there faces)
    const shell = new THREE.Mesh(
      icoGeo,
      new THREE.MeshBasicMaterial({ color: 0x241c17, transparent: true, opacity: 0.35 }) // warm clay shell
    )

    // Glowing core — reads as an energy source, additive so it never muddies
    const coreGeo = new THREE.IcosahedronGeometry(0.85, 2)
    const core = new THREE.Mesh(
      coreGeo,
      new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending })
    )

    // Parent everything under one group (single source of transform truth)
    const group = new THREE.Group()
    group.add(wire, shell, core)
    // Sit off-centre toward the upper-right so it stays out from behind the main text column
    group.position.set(3.2, 1.1, -1)
    scene.add(group)

    // --- Sparse drifting particle field ----------------------------------
    const COUNT = 240
    const positions = new Float32Array(COUNT * 3)
    const speeds = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22
      positions[i * 3 + 1] = (Math.random() - 0.5) * 16
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2
      speeds[i] = 0.002 + Math.random() * 0.004
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: 0xf3ead9, size: 0.028, transparent: true, opacity: 0.3, sizeAttenuation: true }) // warm ember dust
    )
    scene.add(particles)

    // --- Sizing ----------------------------------------------------------
    function resize() {
      const w = mount.clientWidth || window.innerWidth
      const h = mount.clientHeight || window.innerHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    // Subtle parallax toward the pointer (very small; UI stays the hero)
    const target = { x: 0, y: 0 }
    function onPointer(e) {
      target.x = (e.clientX / window.innerWidth - 0.5) * 0.35
      target.y = (e.clientY / window.innerHeight - 0.5) * 0.35
    }
    if (!reduceMotion) window.addEventListener('pointermove', onPointer)

    // --- Loop ------------------------------------------------------------
    let raf = 0
    let t = 0
    const posAttr = pGeo.getAttribute('position')

    function frame() {
      t += 1
      // Slow, weighty rotation — no jitter, no perpetual spin acceleration
      group.rotation.y += 0.0016
      group.rotation.x = Math.sin(t * 0.0009) * 0.16
      core.scale.setScalar(1 + Math.sin(t * 0.02) * 0.06) // gentle breathing core only

      // Drift particles upward, wrap around
      for (let i = 0; i < COUNT; i++) {
        let y = posAttr.getY(i) + speeds[i]
        if (y > 8) y = -8
        posAttr.setY(i, y)
      }
      posAttr.needsUpdate = true

      // Ease camera toward parallax target
      camera.position.x += (target.x - camera.position.x) * 0.03
      camera.position.y += (-target.y - camera.position.y) * 0.03
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }

    if (reduceMotion) {
      renderer.render(scene, camera) // single still frame
    } else {
      raf = requestAnimationFrame(frame)
    }

    // --- Cleanup ---------------------------------------------------------
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          mats.forEach((m) => m.dispose())
        }
      })
      icoGeo.dispose()
      coreGeo.dispose()
      renderer.dispose()
      renderer.forceContextLoss() // release the WebGL context (prevents context buildup on StrictMode remount)
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [accent])

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.35,
      }}
    />
  )
}
