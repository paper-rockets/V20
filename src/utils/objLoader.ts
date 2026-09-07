import * as THREE from 'three';

/**
 * Parses raw Wavefront OBJ text into a Three.js BufferGeometry
 * Supports vertex positions, normals, texture coords, triangles, and quads.
 */
export function parseOBJ(objText) {
  const positions = [];
  const normals = [];
  const uvs = [];

  const finalPositions = [];
  const finalNormals = [];
  const finalUVs = [];

  const lines = objText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const type = parts[0];

    if (type === 'v') {
      positions.push(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3])
      );
    } else if (type === 'vn') {
      normals.push(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3])
      );
    } else if (type === 'vt') {
      uvs.push(
        parseFloat(parts[1]),
        parseFloat(parts[2])
      );
    } else if (type === 'f') {
      const faceVertices = parts.slice(1);
      
      // Helper to process vertex index string "v/vt/vn"
      const getVertex = (vertStr) => {
        const indices = vertStr.split('/');
        const vIdx = parseInt(indices[0], 10);
        const vtIdx = indices[1] ? parseInt(indices[1], 10) : NaN;
        const vnIdx = indices[2] ? parseInt(indices[2], 10) : NaN;

        const pI = (vIdx > 0 ? vIdx - 1 : (positions.length / 3) + vIdx) * 3;
        const pX = positions[pI] || 0;
        const pY = positions[pI + 1] || 0;
        const pZ = positions[pI + 2] || 0;

        let nX = 0, nY = 0, nZ = 0;
        if (!isNaN(vnIdx) && normals.length > 0) {
          const nI = (vnIdx > 0 ? vnIdx - 1 : (normals.length / 3) + vnIdx) * 3;
          nX = normals[nI] || 0;
          nY = normals[nI + 1] || 0;
          nZ = normals[nI + 2] || 0;
        }

        let uX = 0, uY = 0;
        if (!isNaN(vtIdx) && uvs.length > 0) {
          const uI = (vtIdx > 0 ? vtIdx - 1 : (uvs.length / 2) + vtIdx) * 2;
          uX = uvs[uI] || 0;
          uY = uvs[uI + 1] || 0;
        }

        return { pos: [pX, pY, pZ], norm: [nX, nY, nZ], uv: [uX, uY] };
      };

      // Triangulate polygon faces (fan triangulation)
      for (let j = 1; j < faceVertices.length - 1; j++) {
        const v0 = getVertex(faceVertices[0]);
        const v1 = getVertex(faceVertices[j]);
        const v2 = getVertex(faceVertices[j + 1]);

        finalPositions.push(...v0.pos, ...v1.pos, ...v2.pos);
        if (normals.length > 0) {
          finalNormals.push(...v0.norm, ...v1.norm, ...v2.norm);
        }
        if (uvs.length > 0) {
          finalUVs.push(...v0.uv, ...v1.uv, ...v2.uv);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(finalPositions, 3));

  if (finalNormals.length > 0) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(finalNormals, 3));
  } else {
    geometry.computeVertexNormals();
  }

  if (finalUVs.length > 0) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(finalUVs, 2));
  }

  geometry.center();
  return geometry;
}
