<template>
  <canvas ref="hologrameRef"></canvas>
</template>

<script setup lang="ts">
  import * as THREE from 'three';
  import { useTemplateRef,onMounted } from 'vue';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  const hologrameRef = useTemplateRef<HTMLCanvasElement>('hologrameRef');

  const initThree = () => {
  // 创建场景
  const scene = new THREE.Scene();
  // 创建相机
  const camera = new THREE.PerspectiveCamera(75, 500 / 250, 0.1, 1000);
  // 设置相机位置
  camera.position.set(0, 0, 10);
  // 创建模型加载器
  const loader = new GLTFLoader();

  let mixer: THREE.AnimationMixer | null = null;
  const clock = new THREE.Clock();
  // 加载模型
  loader.load('/models/hologram/scene.gltf', (gltf) => {
    // 添加模型到场景
    scene.add(gltf.scene);
    gltf.scene.scale.set(4,4,4);
    if( gltf.animations && gltf.animations.length > 0 ){
      mixer = new THREE.AnimationMixer(gltf.scene);
      gltf.animations.forEach((clip) => {
        const action = mixer!.clipAction(clip);
        action.play();
      })

    }
    

  });

  // 添加环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);
  // 添加定向光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);  

  // 创建渲染器
  const renderer = new THREE.WebGLRenderer({
      canvas: hologrameRef.value!,// 设置渲染器画布 
      alpha: true,// 透明背景
      antialias: true,// 抗锯齿
      precision: 'highp',// 高精度
      powerPreference: 'high-performance',// 高性能
  });
  // 设置渲染器大小
  renderer.setSize(500, 250);

  const controls = new OrbitControls(camera, renderer.domElement);
  const animate = () => {
    requestAnimationFrame(animate);
    if( mixer ){
      mixer.update(clock.getDelta());
    }
    scene.rotation.y += 0.002;
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
  }

  onMounted(() => {
    initThree();
  });

</script>