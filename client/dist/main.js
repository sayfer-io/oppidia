// main.ts
import { PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import * as borsh from 'borsh';
import * as fs from 'fs';
import { Buffer } from 'buffer';
import * as web3 from '@solana/web3.js';
import inquirer from 'inquirer';
const connection = new web3.Connection('http://127.0.0.1:8899', "confirmed");
const PROGRAM_ID = new web3.PublicKey('6Waem1Kn4pTjHc3KQbiMxSsfKpDy7yrPFDeYCcfKL8CG');
const secretKeyString = fs.readFileSync('/Users/desmo/.config/solana/id.json', { encoding: 'utf-8' });
const secretKey = JSON.parse(secretKeyString);
const payer = web3.Keypair.fromSecretKey(new Uint8Array(secretKey));
// Define classes to mirror Rust structs
const CriticalFunctionSchema = {
    struct: {
        WithdrawAllFunds: {
            struct: {
                target_pubkey: '4RT6vQcVUsY8Zre7ciEXe8HLETQzMgqdAcDsMmdjMJCN',
                amount: '1000000',
            },
        },
        DeleteAccount: { struct: {} },
    }
};
const QueuedFunctionSchema = {
    struct: {
        func: CriticalFunctionSchema,
        execution_time: 'bigint',
        cancelled: 'bool',
        initiator: 'string',
        delegate: { option: 'string' }
    }
};
const QueueCriticalFunctionSchema = {
    struct: {
        func: CriticalFunctionSchema,
        delay_in_seconds: 'bigint'
    }
};
const CancelFunctionSchema = {
    struct: {
        function_index: 'u32'
    }
};
const SetDelegateSchema = {
    struct: {
        delegate_pubkey: 'string'
    }
};
const InstructionSchema = {
    enum: [
        { struct: { type: 'string', function: CriticalFunctionSchema, delay_in_seconds: 'bigint' } },
        { struct: { type: 'string', function_index: 'u32' } },
        { struct: { type: 'string', delegate_pubkey: 'string' } }
    ]
};
const ContractStateSchema = {
    struct: {
        queued_functions: { array: { type: QueuedFunctionSchema } },
        delegate: { option: 'string' }
    }
};
const SCHEMA = {
    struct: {
        CriticalFunction: CriticalFunctionSchema,
        QueuedFunction: QueuedFunctionSchema,
        QueueCriticalFunction: QueueCriticalFunctionSchema,
        CancelFunction: CancelFunctionSchema,
        SetDelegate: SetDelegateSchema,
        Instruction: InstructionSchema,
        ContractState: ContractStateSchema //error here
    }
};
////////////////////////////////////////////////////////////////////////
// imported functions from previous version
////////////////////////////////////////////////////////////////////////
// Fund Account
async function fundAccount(accountPubKey) {
    const transaction = new web3.Transaction().add(web3.SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: accountPubKey,
        lamports: 10000000,
    }));
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;
    transaction.sign(payer);
    const txId = await connection.sendTransaction(transaction, [payer]);
    console.log(`Transferred funds to ${accountPubKey.toBase58()}`);
}
// sendTransactionwithData 
async function sendTransactionWithData(dataAccount, instructionData) {
    const transaction = new web3.Transaction().add(new web3.TransactionInstruction({
        keys: [
            { pubkey: dataAccount.publicKey, isSigner: false, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: instructionData
    }));
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;
    transaction.sign(payer);
    try {
        const txId = await connection.sendTransaction(transaction, [payer]);
        console.log(`Transaction sent with txID: ${txId}. Awaiting confirmation...`);
        await connection.confirmTransaction(txId, 'confirmed');
        console.log(`Transaction confirmed with txID: ${txId}`);
    }
    catch (error) {
        console.error(`Failed to send transaction: ${error.message}`);
    }
}
// cancel function 
// async function cancelFunction(dataAccount: web3.Keypair, function_index: number) {
//     console.log("Attempting to cancel the withdrawal...");
//     const instructionData = Buffer.from([1]);
//     await sendTransactionWithData(dataAccount, instructionData);
// }
// simplified cancel funtion 
async function cancelFunction(dataAccount) {
    console.log("Attempting to cancel the withdrawal...");
    const instructionData = Buffer.concat([
        Buffer.from([1]),
        Buffer.from(Uint32Array.of(0).buffer) // function_index as a 4-byte buffer, hardcoded as 0
    ]);
    await sendTransactionWithData(dataAccount, instructionData);
}
// check execution
async function checkExecution(dataAccount) {
    try {
        const accountInfo = await connection.getAccountInfo(dataAccount.publicKey);
        if (accountInfo.data[0] === 0) {
            console.log("Withdrawal function is queued but not executed.");
        }
        else if (accountInfo.data[0] === 1) {
            console.log("Withdrawal function was cancelled.");
        }
        else {
            console.log("Withdrawal function has been executed.");
        }
    }
    catch (error) {
        console.error(`Failed to check execution: ${error.message}`);
    }
}
// Simplified the setDelegate to use sendTransactionWithData
async function setDelegate(dataAccount) {
    const delegateAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'delegate',
            message: 'Enter the public key of the trusted delegate:',
        }
    ]);
    const delegatePublicKey = new web3.PublicKey(delegateAnswer.delegate);
    const instructionData = Buffer.concat([Buffer.from([2]), delegatePublicKey.toBuffer()]);
    await sendTransactionWithData(dataAccount, instructionData);
}
////////////////////////////////////////////////////////////////////////
// end of imported functions from previous version
////////////////////////////////////////////////////////////////////////
// Function to serialize an instruction to a Buffer
function serializeInstruction(instruction) {
    return Buffer.from(borsh.serialize(SCHEMA, instruction));
}
// Function to queue a critical function
async function queueCriticalFunction(criticalFunction, delayInSeconds) {
    // Get your contract's public key and your wallet's keypair
    const PROGRAM_ID = new PublicKey('6Waem1Kn4pTjHc3KQbiMxSsfKpDy7yrPFDeYCcfKL8CG');
    // Create a transaction
    const transaction = new Transaction().add({
        keys: [{ pubkey: PROGRAM_ID, isSigner: false, isWritable: true }],
        programId: PROGRAM_ID,
        data: serializeInstruction({
            type: 'QueueCriticalFunction',
            function: criticalFunction,
            delay_in_seconds: delayInSeconds,
        }),
    });
    // Sign and send the transaction
    await sendAndConfirmTransaction(connection, transaction, [payer]);
}
// Function to cancel a queued function
// async function cancelFunction(function_index) {
//     // Get your contract's public key and your wallet's keypair
//     const contractPublicKey = new PublicKey('6Waem1Kn4pTjHc3KQbiMxSsfKpDy7yrPFDeYCcfKL8CG');
//     const walletKeypair = payer;
// Create a transaction
const transaction = new Transaction().add({
    keys: [{ pubkey: PROGRAM_ID, isSigner: false, isWritable: true }],
    programId: PROGRAM_ID,
    data: serializeInstruction({
        type: 'CancelFunction',
        function_index: 0, // Explicitly set function_index to 0
    }),
});
// Sign and send the transaction
await sendAndConfirmTransaction(connection, transaction, [payer]);
async function callCriticalFunction(dataAccount, criticalFunction, delayInSeconds) {
    console.log("Function to withdraw all funds initialized...");
    console.log("⚠️ WARNING: Critical function detected, initiating Timelock safety operation...");
    const instruction = {
        type: 'QueueCriticalFunction',
        function: criticalFunction,
        delay_in_seconds: delayInSeconds,
    };
    const instructionData = serializeInstruction(instruction);
    console.log(`Serialized data: ${instructionData.toString('hex')}`);
    await sendTransactionWithData(dataAccount, instructionData);
}
async function main() {
    const dataAccount = web3.Keypair.generate();
    console.log(`Using new data account: ${dataAccount.publicKey.toBase58()}`);
    await fundAccount(dataAccount.publicKey);
    const questions = [
        {
            type: 'list',
            name: 'action',
            message: 'What do you want to do?',
            choices: ['Withdraw All Funds', 'Cancel Function', 'Check Execution', 'Set Delegate'],
        }
    ];
    const answers = await inquirer.prompt(questions);
    switch (answers.action) {
        case 'Withdraw All Funds':
            const amountInLamports = 1000000;
            const targetPubkey = "4RT6vQcVUsY8Zre7ciEXe8HLETQzMgqdAcDsMmdjMJCN";
            const criticalFunction = {
                type: 'WithdrawAllFunds',
                target_pubkey: targetPubkey,
                amount: BigInt(amountInLamports)
            };
            await callCriticalFunction(dataAccount, criticalFunction, BigInt(30)); // 30 second delay
            break;
        case 'Cancel Function':
            await cancelFunction(dataAccount);
            break;
        case 'Check Execution':
            await checkExecution(dataAccount);
            break;
        case 'Set Delegate':
            await setDelegate(dataAccount);
            break;
    }
}
main();
