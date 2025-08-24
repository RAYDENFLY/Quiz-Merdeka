"use client";
import React from "react";
import QuizPage from "../quiz";

export default function Page(props: any) {
  // Render the existing client-side QuizPage component which lives at src/app/quiz.tsx
  return <QuizPage {...props} />;
}
