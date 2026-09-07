# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary users are creative hobbyists, including people who are curious about spatial drawing but are not professional artists or experienced 3D-software users. Android phone and tablet users are especially important, while desktop use remains supported.

Users should be able to start making something without first learning professional 3D terminology or understanding a large technical toolset.

## Product Purpose

The product is an accessible spatial 3D drawing application. It supports two equally important creative activities: drawing freely in 3D space and drawing directly over imported 3D models.

Success means that a hobbyist can understand the core workflow, enjoy creating with it, preserve their work reliably, and produce clean images or 3D files that are useful outside the application.

## Positioning

The product brings approachable spatial drawing to the web, with particular attention to Android and tablet users who do not have access to Apple-only creative tools. It combines a low learning barrier with sufficiently reliable drawing, editing, and export tools to produce polished results.

It must have its own identity and must not be presented, named, or marketed as Feather 3D. Feather is background inspiration only. The creator reports that no Feather source code was copied.

## Operating Context

The expected workflow is:

1. Begin on a blank spatial canvas or import a 3D model.
2. Draw in open space or attach strokes to a surface using touch, mouse, or stylus input.
3. Refine the work with selection, transforms, brush controls, symmetry, and layers.
4. Rely on automatic local saving and recovery during creation.
5. Export a high-quality image or interoperable 3D file.

The product is expected to work as an installable web application and remain practical on touch-first Android devices as well as desktop browsers.

## Capabilities and Constraints

- The existing application uses React, TypeScript, Three.js, and Vite.
- Rendering, drawing, project storage, and export primarily run locally in the browser.
- Free-space drawing and surface-attached drawing are equally important product capabilities.
- Stylus pressure, predictable smoothing, reliable surface attachment, layers, transforms, autosave, and clean export are core capabilities.
- GLB and high-resolution image export are primary outputs. Additional formats may be offered through progressive disclosure.
- The current repository contains many advanced or experimental capabilities. Their existence does not make them permanent product requirements.
- Simplicity, stability, and learnability take priority over preserving every existing feature.
- The final product name, commercial model, licensing terms, and exact launch feature set remain open decisions.

## Brand Commitments

- The final product name is undecided.
- The product must have a distinct identity rather than presenting itself as a version or clone of Feather 3D.
- Public language should be friendly and understandable to creative hobbyists, not written as CAD, graphics-engine, or shader documentation.
- Technical sophistication should be felt through the quality of the result rather than advertised through a large number of controls.

## Evidence on Hand

- The working V20 application and source repository are the primary evidence of current capability.
- The deployed application demonstrates live 3D drawing, model loading, touch-oriented controls, local project storage, and multiple export paths.
- The repository contains sample models and third-party assets with some source-license records under `public/imported_templates`.
- There are currently no confirmed customer testimonials, usage studies, sales results, professional endorsements, or independently verified performance claims. Future work must not fabricate them.

## Product Principles

1. Make the first useful stroke easy.
2. Prefer a few dependable creative tools over many experimental options.
3. Hide technical machinery behind strong defaults and progressive disclosure.
4. Protect the user’s work before adding spectacle.
5. Professional output quality comes from predictable strokes, precise editing, and reliable export—not feature count.

## Accessibility & Inclusion

The interface must be usable by people without prior 3D-software knowledge. It should use plain-language labels, comfortably sized touch targets, visible interaction states, keyboard-accessible controls where applicable, and layouts that remain usable on Android phones and tablets. Accessibility must not be sacrificed to make the interface visually minimal.
