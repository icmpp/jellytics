import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
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
          gap: "10px",
          height: "55%",
        }}
      >
        <div
          style={{
            width: "20px",
            height: "30%",
            background: "white",
            borderRadius: "4px",
          }}
        />
        <div
          style={{
            width: "20px",
            height: "50%",
            background: "white",
            borderRadius: "4px",
          }}
        />
        <div
          style={{
            width: "20px",
            height: "75%",
            background: "white",
            borderRadius: "4px",
          }}
        />
        <div
          style={{
            width: "20px",
            height: "55%",
            background: "white",
            borderRadius: "4px",
          }}
        />
      </div>
    </div>,
    {
      ...size,
    },
  );
}
