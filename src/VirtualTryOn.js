import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";

const VirtualTryOn = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [model, setModel] = useState(null);
  const [glassesMesh, setGlassesMesh] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadResources = async () => {
      try {
        // Camera Access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
        }

        // TensorFlow Model
        await tf.setBackend("webgl");
        const loadedModel = await faceLandmarksDetection.load(
          faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
          {
            shouldLoadIrisModel: true,
            maxFaces: 1,
          }
        );
        setModel(loadedModel);

        // Three.js Setup
        const width = canvasRef.current.clientWidth;
        const height = canvasRef.current.clientHeight;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
          75,
          width / height,
          0.1,
          1000
        );
        camera.position.z = 5;
        const renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          alpha: true,
        });
        renderer.setSize(width, height);
        renderer.setAnimationLoop(() => renderer.render(scene, camera));

        // Load 3D Glasses Model
        const loader = new GLTFLoader();
        loader.load(
          "glasses_07.glb",
          (gltf) => {
            const glasses = gltf.scene;
            glasses.scale.set(0.05, 0.05, 0.05); // Adjusted the scale
            scene.add(glasses);
            setGlassesMesh(glasses);
            setIsLoading(false);
          },
          undefined,
          (error) => {
            console.error("An error happened while loading the model:", error);
            setIsLoading(false);
          }
        );
      } catch (error) {
        console.error("Initialization error:", error);
        setIsLoading(false);
      }
    };

    loadResources();
  }, []);

  useEffect(() => {
    const detectAndPositionGlasses = async () => {
      if (!webcamRef.current || !model || !glassesMesh) return;
      const video = webcamRef.current.video;
      if (video.readyState !== 4) return;

      const faceEstimates = await model.estimateFaces({ input: video });
      if (faceEstimates.length > 0) {
        setIsLoading(false);
        // Face mesh keypoints
        const keypoints = faceEstimates[0].scaledMesh;
        const leftEye = keypoints[130];
        const rightEye = keypoints[359];
        const noseTip = keypoints[70];
        const eyeCenter = keypoints[168];

        // Eye distance for glasses scaling
        const eyeDistance = Math.sqrt(
          Math.pow(rightEye[0] - leftEye[0], 2) +
            Math.pow(rightEye[1] - leftEye[1], 2)
        );
        const scaleMultiplier = eyeDistance / 250; // Adjusted the scale multiplier for better fit

        // Glasses scaling and offset values
        const scaleX = 0.01; // Adjusted the scale to follow X movement more closely
        const scaleY = 0.01;
        const offsetX = 0.0;
        const offsetY = -0.1;

        // Glasses positioning
        glassesMesh.position.x =
          (eyeCenter[0] - video.videoWidth / 2) * scaleX + offsetX;

        glassesMesh.position.y =
          (eyeCenter[1] - video.videoHeight / 2) * -scaleY + offsetY;
        glassesMesh.scale.set(
          scaleMultiplier,
          scaleMultiplier,
          scaleMultiplier
        );
        glassesMesh.position.z = 1;

        // Calculate rotation angles based on facial keypoints
        const eyeLine = new THREE.Vector2(
          rightEye[0] - leftEye[0],
          rightEye[1] - leftEye[1]
        );
        const angleY = -Math.atan2(eyeLine.y, eyeLine.x);

        const vectorNoseToEyeCenter = new THREE.Vector2(
          eyeCenter[0] - noseTip[0],
          eyeCenter[1] - noseTip[1]
        );
        const angleX = Math.atan2(
          vectorNoseToEyeCenter.y,
          vectorNoseToEyeCenter.x
        );
        const angleZ = -Math.atan2(eyeLine.y, eyeLine.x);

        // Apply rotation to the glasses
        glassesMesh.rotation.x = angleX;
        glassesMesh.rotation.y = angleY;
        glassesMesh.rotation.z = angleZ; // Ensure proper alignment in depth
      }
    };

    // Run detection and positioning every 120ms
    const intervalId = setInterval(() => {
      detectAndPositionGlasses();
    }, 20);

    return () => clearInterval(intervalId);
  }, [model, glassesMesh]);

  return (
    <>
      <div style={{ borderBottom: "1px solid rgba(0, 0, 0, 0.2)" }}>
        <h1 style={{ textAlign: "center" }}>Virtual Try-On - 3D Model</h1>
      </div>
      <div
        style={{
          position: "relative",
          margin: "0 auto",
          width: "800px",
          height: "800px",
        }}
      >
        {isLoading && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(255, 255, 255, 0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 2,
            }}
          >
            <h3>Loading...</h3>
          </div>
        )}
        <Webcam
          ref={webcamRef}
          autoPlay
          playsInline
          style={{ width: "800px", height: "800px" }}
          mirrored={false}
        />
        <canvas
          ref={canvasRef}
          style={{
            width: "800px",
            height: "800px",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        />
      </div>
    </>
  );
};

export default VirtualTryOn;
