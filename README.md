# Spritz Finance Contracts [![Hardhat][hardhat-badge]][hardhat] [![License: MIT][license-badge]][license]

[hardhat]: https://hardhat.org/
[hardhat-badge]: https://img.shields.io/badge/Built%20with-Hardhat-FFDB1C.svg
[license]: https://opensource.org/licenses/MIT
[license-badge]: https://img.shields.io/badge/License-MIT-blue.svg

## Getting Started

Click the [`Use this template`](https://github.com/paulrberg/hardhat-template/generate) button at the top of the page to
create a new repository with this repo as the initial state.

## Security Toolbox

Spritz Finance contracts make use of the [`trailofbits/eth-security-toolbox`](https://github.com/trailofbits/eth-security-toolbox) to analyze it's contracts with the most popular eth security tools.

To download the toolbox, run `docker pull trailofbits/eth-security-toolbox`
The toolbox isstance can then be launched by running the command `yarn toolbox` or `docker run -it --rm -v $PWD:/src trailofbits/eth-security-toolbox` from the PWD.

### Slither

Open the docker shell:

```
yarn toolbox
```

Then, run:

```
slither /src/contracts/ --solc-remaps @openzeppelin=/src/node_modules/@openzeppelin --exclude naming-convention,external-function,low-level-calls --filter-paths @openzeppelin
```

To exit:

```
exit
```

### Echidna

Open the docker shell:

```
yarn toolbox
```

Then, run this:

```
echidna-test /src/test/fuzzing/SpritzPayFuzzTest.sol --contract SpritzPayFuzzTest --config /src/test/fuzzing/config.yaml
```

To exit:

```
exit
```

## Usage

### Compile

### Pre Requisites

Before being able to run any command, you need to create a `.env` file and set a BIP-39 compatible mnemonic as an environment
variable. You can follow the example in `.env.example`. If you don't already have a mnemonic, you can use this [website](https://iancoleman.io/bip39/) to generate one.

Then, proceed with installing dependencies:

```sh
$ yarn install
```

### Compile

Compile the smart contracts with Hardhat:

```sh
$ yarn compile
```

### TypeChain

Compile the smart contracts and generate TypeChain bindings:

```sh
$ yarn typechain
```

### Test

Run the tests with Hardhat:

```sh
$ yarn test
```

### Lint Solidity

Lint the Solidity code:

```sh
$ yarn lint:sol
```

### Lint TypeScript

Lint the TypeScript code:

```sh
$ yarn lint:ts
```

### Coverage

Generate the code coverage report:

```sh
$ yarn coverage
```

### Report Gas

See the gas usage per unit test and average gas per method call:

```sh
$ REPORT_GAS=true yarn test
```

### Clean

Delete the smart contract artifacts, the coverage reports and the Hardhat cache:

```sh
$ yarn clean
```

### Deploy

Deploy the contracts to Hardhat Network:

```sh
$ yarn deploy --greeting "Bonjour, le monde!"
```

## Tips

### Syntax Highlighting

If you use VSCode, you can get Solidity syntax highlighting with the [hardhat-solidity](https://marketplace.visualstudio.com/items?itemName=NomicFoundation.hardhat-solidity) extension.

## License

[MIT](./LICENSE.md) © Spritz Finance
