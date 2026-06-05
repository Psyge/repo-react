export function drawSky(
  ctx,
  w,
  h,
  isDay,
  isTwilight,
  month
) {
  const sky =
    ctx.createLinearGradient(
      0,
      0,
      0,
      h
    );

  if (isDay) {

    // TALVI
    if (
      month === 11 ||
      month === 0 ||
      month === 1
    ) {
      sky.addColorStop(
        0,
        "#9ec6ff"
      );

      sky.addColorStop(
        1,
        "#eef6ff"
      );
    }

    // KEVÄT
    else if (
      month >= 2 &&
      month <= 4
    ) {
      sky.addColorStop(
        0,
        "#6aa8ff"
      );

      sky.addColorStop(
        1,
        "#d9efff"
      );
    }

    // KESÄ
    else if (
      month >= 5 &&
      month <= 7
    ) {
      sky.addColorStop(
        0,
        "#4d9fff"
      );

      sky.addColorStop(
        1,
        "#cde8ff"
      );
    }

    // SYKSY
    else {
      sky.addColorStop(
        0,
        "#7fa4d8"
      );

      sky.addColorStop(
        1,
        "#d7d0c2"
      );
    }

  }
  else if (isTwilight) {

    sky.addColorStop(
      0,
      "#20103a"
    );

    sky.addColorStop(
      0.5,
      "#7a2f4f"
    );

    sky.addColorStop(
      1,
      "#ff8a3d"
    );
  }
  else {

    sky.addColorStop(
      0,
      "#02040a"
    );

    sky.addColorStop(
      1,
      "#081020"
    );
  }

  ctx.fillStyle = sky;
  ctx.fillRect(
    0,
    0,
    w,
    h
  );
}