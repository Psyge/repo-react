export function drawGround(
  ctx,
  w,
  h,
  month
) {
  const horizonY =
    h * 0.72;

  let top;
  let bottom;

  if ([11,0,1].includes(month)) {
    top = "#dce8f2";
    bottom = "#7d8d99";
  }
  else if ([2,3].includes(month)) {
    top = "#8a7a6a";
    bottom = "#3a2a1a";
  }
  else if ([4,5,6,7].includes(month)) {
    top = "#2f6a22";
    bottom = "#102010";
  }
  else {
    top = "#b45c22";
    bottom = "#4d1f0f";
  }

  const ground =
    ctx.createLinearGradient(
      0,
      horizonY,
      0,
      h
    );

  ground.addColorStop(
    0,
    top
  );

  ground.addColorStop(
    1,
    bottom
  );

  ctx.fillStyle = ground;

  ctx.fillRect(
    0,
    horizonY,
    w,
    h - horizonY
  );
}