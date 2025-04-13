# Project: Centralized Presentation Hub

## 1. Overview

Create a web application to serve as a central repository for hosting and presenting talks and presentations.

## 2. Goals

*   Provide a single, accessible platform for all presentations.
*   Enable rich, interactive content within slides, including 3D graphics.
*   Allow for flexible content creation methods.

## 3. Features

*   **Presentation Hosting:** The application will host multiple presentations.
*   **Reveal.js Integration:** Use reveal.js for the core presentation framework, including slide structure, navigation, and themes.
*   **Markdown Content:** Support creating slide content using Markdown files.
*   **React Component Slides:** Allow defining complex slides as React components.
*   **Three.js Integration:** Enable embedding interactive three.js scenes within specific slides.
*   **Styling:** Utilize Tailwind CSS for styling the application and slide content.
*   **Custom Templates:** Support defining custom slide templates and creating presentations based on them.

## 4. Technical Stack

*   **Framework:** Next.js
*   **Language:** TypeScript
*   **Presentation Library:** reveal.js
*   **3D Graphics Library:** three.js
*   **Styling:** Tailwind CSS
*   **Content Processing:** Markdown parser (e.g., `react-markdown`, `next-mdx-remote`)

## 5. Non-Goals (Initially)

*   A visual editor for slides.
