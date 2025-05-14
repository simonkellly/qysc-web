# QYSC Web

A TypeScript library for interacting with QYSC (QiYi Smart Cube) devices via Web Bluetooth API.

A sample app can be seen at https://simonkellly.github.io/qysc-web

## Features

- Web Bluetooth integration for QYSC devices
- Cube state management and manipulation
- RxJS integration for reactive programming
- TypeScript support with full type definitions

This library follows closely to the standard set by [gan-web-bluetooth](https://github.com/afedotov/gan-web-bluetooth) and implements the qiyi smart cube protocol described at [qiyi_smartcube_protocol](https://github.com/Flying-Toast/qiyi_smartcube_protocol/) with some help from [qy-cube](https://github.com/agolovchuk/qy-cube/blob/main/LICENSE)

## Installation

```bash
npm install qysc-web
# or
yarn add qysc-web
# or
bun add qysc-web
```

## Usage

There is a very basic sample-app within this repository, but the core usage can be seen below.

```typescript
import { connectQYSC } from 'qysc-web';

// Connect to a QYSC device
const cube = await connectQYSC();

// Listen for cube state changes
cube.events.moves.subscribe(move => {
  console.log('Cube Moved:', move);
});

// Disconnect when done
cube.disconnect();
```

## Development

This project uses Bun as the package manager and build tool.

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Link the package for the sample app
bun link qysc-web

# Publish the package to NPM
bun publish
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
