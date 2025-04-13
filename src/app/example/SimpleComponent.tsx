"use client";

import React from "react";

interface SimpleComponentProps {
  message: string;
}

const SimpleComponent: React.FC<SimpleComponentProps> = ({ message }) => {
  return (
    <div
      style={{ border: "1px solid cyan", padding: "10px", margin: "10px 0" }}
    >
      <p>This is a React component!</p>
      <p>
        Message: <strong>{message}</strong>
      </p>
    </div>
  );
};

export default SimpleComponent;
