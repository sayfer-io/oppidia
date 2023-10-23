## Oppidia

![logo](assets/logo.png)

Oppidia is a next-gen program protection firewall tool kit built on Solana, providing an added layer of security and
abstraction.
Our mission is to provide a secure and easy-to-use collection of programs and libraries for developers to protect their
programs and users from malicious attacks while reducing development time.

### 🌟 Features

- **Delayed Transaction Execution**: Adds a delay to critical functions, providing a safety window for transaction
  reviews.
- **Cancellation Capability**: Grants the ability to cancel scheduled transactions using trusted wallets.
- **Enhanced Security**: Minimize the risk of unwanted or malicious transactions by adding a protective time barrier.

### 🔧 Installation

#### Solana-Rust
Required for use [Rust](https://www.rust-lang.org/tools/install) and the [Solana Tool Suite](https://docs.solana.com/cli/install-solana-cli-tools). 
Please install before proceeding. You will also need to generate local keys or a file system wallet follow the instructions [Generate a File System Wallet Keypair](https://docs.solana.com/wallet-guide/file-system-wallet). 


- Build your smart-contract from the src/rust folder by using `cargo build-sbf` this will output the deployable smart-contract to your `target` folder.
- Start your local test-net using on your terminal `solana-test-validator` once started you can deploy your contract.
- Configure your local by setting your configuration with `solana config set --url localhost`
- You can confirm correct configuration with `solana config get`
- Deploy your contract using `solana program deploy <program/path/program.so>`
- Once deployed you will get an output with the `Program Id` make note of that for use on the client side. 

If all went smoothly you should have a contract deployed on your local validator to interact with.

#### Solana-Client
You need to install `@Solana/Web3.js` by going into the `src/client` folder in your terminal and running:
- `npm install --save @solana/web3.js`
Note: if there's a package.json file remove it as this install will create it for you.
- This should give you the `node_modules` folder as well as a `package.json` and a `package-lock.json` file.

Update connection, public and target key within the code to your updated values.

1. const connection = new web3.Connection('<http://127.0.0.1:8899>'); *This is your local validator address.*
2. const PROGRAM_ID = new web3.PublicKey('<Program Id>'); *This your newly generated `Program Id` that you just created.*
3. const secretKeyString = fs.readFileSync('.config/solana/id.json', { encoding: 'utf-8' }); *This is where your local keys are stored*
4. const targetPubkey = "<test-key-address>"; *This is a different address to test sending/withdrawing funds with.*

##### Scripts
For ease of use you can update the scripts inside your `package.json` here's an example of how to set it up.
This is especially handy when updating the smart contract because with any change made to the smart contract you must
"clean" "build" and redeploy to generate a new `Program Id`.

```"scripts": {
    "build": "tsc",
    "start": "tsc && node dist/main.js",
    "clean": "npm run clean:program",
    "program:build": "cargo build-bpf --manifest-path=../chrono_key/Cargo.toml --bpf-out-dir=../chrono_key/target",
    "program:clean": "cargo clean --manifest-path=../chrono_key/Cargo.toml && rm -rf ../chrono_key/target",
    "program:test": "cargo test-sbf --manifest-path=../chrono_key/Cargo.toml",
    "program:deploy": "solana program deploy ../chrono_key/target/chrono_key.so"
  },
  ```

Once updated you should be able to use `npm run start` to interact to the smart contract.
*Note: this is still currently under development so issues may arise when attempting to connect*.

### 📝 Usage
The concept for this is to show the "time-lock" mechanism in action. We have a basic CLI to walk you through the process.
When starting the client you'll get a prompt *What do you want to do?*

- **Withdraw All Funds**: as the name implies will attempt to withdraw all funds from specified wallet `targetPubkey`. Which will trigger the timelock mechanism.
- **Cancel Function**: This will cancel the function in time-lock.
- **Check Execution**: Will check the status of function
- **Set Delegate**: Allows you to set a trusted delegate to also be able to cancel the function.
  
*Note: Still in rapid development and there could be many changes/bugs*


### 🗺️ Roadmap
<small>*Not in particular order</small>
- 
- [ ] Transform into a standalone lib where developers can import the logic into their own programs
- [ ] Adding more modules other than time locking
- [ ] Create a module collections with customization for edge cases
- [ ] Create a contribution guide on how developers can join the effort
- [ ] Implement tests and CI/CD workflows
- [ ] Create a website for the project
- [ ] Create a documentation website with examples and tutorials
- [ ] Create a CLI tool for easy integration with existing programs

### 📣 Contributing

We appreciate and welcome contributions from the community! 
Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) for details on how to contribute to this project.

### 🌐 License

This project is licensed under GPL-3.0. See the [`LICENSE`](LICENSE) file for details.

### 📬 Contact Us

```
Email: info@sayfer.io
Twitter: @SayferSecurity
```
