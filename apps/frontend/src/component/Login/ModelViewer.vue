<template>
  <div
    class="relative w-[800px] h-full bg-linear-to-br from-gray-800 to-gray-900"
  >
    <canvas class="w-full h-full" ref="canvasRef"></canvas>
    <div class="absolute top-6 left-6">
      <div class="flex items-center gap-2">
        <div
          class="w-10 h-10 bg-linear-to-br from-indigo-500 to-purple-600 rounded-[10px] flex items-center justify-center"
        >
          <span class="text-white font-bold text-xl">E</span>
        </div>
        <span class="text-white text-xl font-bold">English App</span>
      </div>
    </div>
    <!-- 登录/注册切换按钮 -->
    <div class="absolute top-6 right-6">
      <div
        class="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-1"
      >
        <button @click="loadModel('login')" :class="loginClass">登录</button>
        <button @click="loadModel('register')" :class="registerClass">
          注册
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, useTemplateRef } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LoginType } from './type';
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef');

const type = ref<'login' | 'register'>('login');
const loginClass = computed(() => {
  return type.value === 'login'
    ? 'bg-indigo-500 text-white shadow-lg px-4 py-2 rounded-md text-sm font-medium transition-all'
    : 'text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-md text-sm font-medium transition-all';
});
const registerClass = computed(() => {
  return type.value === 'register'
    ? 'bg-indigo-500 text-white shadow-lg px-4 py-2 rounded-md text-sm font-medium transition-all'
    : 'text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-md text-sm font-medium transition-all';
});

const emits = defineEmits(['changeType']);

let mixer: THREE.AnimationMixer | null = null;
const clock = new THREE.Clock();
const scene = new THREE.Scene();
let currentModel: THREE.Group | null = null;

const loadModel = (url: LoginType) => {
  const loader = new GLTFLoader();
  type.value = url;
  if (currentModel) {
    scene.remove(currentModel);
    currentModel = null;
  }
  if (url === 'login') {
    loader.load('/models/login/scene.gltf', (gltf) => {
      currentModel = gltf.scene;
      scene.add(currentModel);
      scene.position.y = -0.8;
      currentModel.scale.set(0.8, 0.8, 0.8);
    });
  }
  if (url === 'register') {
    loader.load('/models/register/scene.gltf', (gltf) => {
      currentModel = gltf.scene;
      scene.add(currentModel);
      scene.position.y = -0.8;
      currentModel.scale.set(0.8, 0.8, 0.8);
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(currentModel);
        gltf.animations.forEach((clip) => {
          const action = mixer!.clipAction(clip);
          action.play();
        });
      }
    });
  }

  emits('changeType', url);
};

const initThree = () => {
  const width = canvasRef.value!.clientWidth;
  const height = canvasRef.value!.clientHeight;
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.set(1, 0.5, 1);
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value!,
    antialias: true,
    alpha: true,
    precision: 'highp',
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.render(scene, camera);
  loadModel(type.value);
  const controls = new OrbitControls(camera, renderer.domElement);
  const animate = () => {
    requestAnimationFrame(animate);
    if (mixer) {
      mixer.update(clock.getDelta());
    }
    scene.rotation.y += 0.002;
    controls.update();
    renderer.render(scene, camera);
  };
  animate();
};

onMounted(() => {
  initThree();
});
</script>
