import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
        borderRadius: "20%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "2px",
          height: "65%",
        }}
      >
        <div
          style={{
            width: "4px",
            height: "30%",
            background: "white",
            borderRadius: "1px",
          }}
        />
        <div
          style={{
            width: "4px",
            height: "50%",
            background: "white",
            borderRadius: "1px",
          }}
        />
        <div
          style={{
            width: "4px",
            height: "75%",
            background: "white",
            borderRadius: "1px",
          }}
        />
        <div
          style={{
            width: "4px",
            height: "55%",
            background: "white",
            borderRadius: "1px",
          }}
        />
      </div>
    </div>,
    {
      ...size,
    },
  );
}
