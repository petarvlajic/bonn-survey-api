const canvas = require('canvas');
const fs = require('fs');

function createMockSignature() {
  const width = 300;
  const height = 100;
  const c = canvas.createCanvas(width, height);
  const ctx = c.getContext('2d');

  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);

  // Simple signature-like line
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw a simple signature curve
  ctx.beginPath();
  ctx.moveTo(20, 60);
  ctx.quadraticCurveTo(75, 20, 130, 60);
  ctx.quadraticCurveTo(160, 80, 200, 50);
  ctx.quadraticCurveTo(240, 20, 280, 70);
  ctx.stroke();

  return c.toBuffer('image/png').toString('base64');
}

const sig = createMockSignature();
console.log('data:image/png;base64,' + sig);
