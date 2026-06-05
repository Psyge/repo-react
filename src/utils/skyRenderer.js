export function drawSky(
  ctx,
  w,
  h,
  isDay,
  isTwilight
) {
  const sky =
    ctx.createLinearGradient(
      0,
      0,
      0,
      h
    );

  if (isDay) {
    sky.addColorStop(0, "#5aa7ff");
    sky.addColorStop(1, "#d7ecff");
  }
  else if (isTwilight) {
    sky.addColorStop(0, "#20103a");
    sky.addColorStop(0.5, "#7a2f4f");
    sky.addColorStop(1, "#ff8a3d");
  }
  else {
    sky.addColorStop(0, "#02040a");
    sky.addColorStop(1, "#081020");
  }

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
}