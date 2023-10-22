// main.ts
import {
    PublicKey, Transaction,
    sendAndConfirmTransaction, Keypair
} from '@solana/web3.js';
import * as borsh from 'borsh';
import * as fs from 'fs';
import {Buffer} from 'buffer';
import {
    Instruction,
    CriticalFunction,
    ContractState,
    QueuedFunction,
} from './types';  
import { Schema, Enum, Struct } from 'borsh';
import * as web3 from '@solana/web3.js';
import inquirer from 'inquirer';

const connection = new web3.Connection('http://127.0.0.1:8899', "confirmed");
const PROGRAM_ID = new web3.PublicKey('6Waem1Kn4pTjHc3KQbiMxSsfKpDy7yrPFDeYCcfKL8CG');
const secretKeyString = fs.readFileSync('/Users/desmo/.config/solana/id.json', { encoding: 'utf-8' });
const secretKey = JSON.parse(secretKeyString);
const payer = web3.Keypair.fromSecretKey(new Uint8Array(secretKey));

class CriticalFunctionStruct {
    type: string;
    target_pubkey: string;
    amount: number;
    constructor(fields: Partial<CriticalFunctionStruct>) {
        Object.assign(this, fields);
    }
}

class QueuedFunctionStruct {
    func: CriticalFunctionStruct;
    execution_time: bigint;
    cancelled: boolean;
    initiator: string;
    delegate: string | null;
    constructor(fields: Partial<QueuedFunctionStruct>) {
        Object.assign(this, fields);
    }
}

class QueueCriticalFunctionStruct {
    func: CriticalFunctionStruct;
    delay_in_seconds: bigint;
    constructor(fields: Partial<QueueCriticalFunctionStruct>) {
        Object.assign(this, fields);
    }
}

class SetDelegateStruct {
    delegate_pubkey: string;
    constructor(fields: Partial<SetDelegateStruct>) {
        Object.assign(this, fields);
    }
}

class CancelFunctionStruct {
    function_index: number;
    constructor(fields: Partial<CancelFunctionStruct>) {
        Object.assign(this, fields);
    }
}

class InstructionStruct {
    type: string;
    function: CriticalFunctionStruct | null;  // Assuming the function can be one of the defined structs or null
    delay_in_seconds: bigint | null;
    function_index: number | null;
    delegate_pubkey: string | null;
    constructor(fields: Partial<InstructionStruct>) {
        Object.assign(this, fields);
    }
}

class ContractStateStruct {
    queued_functions: QueuedFunctionStruct[];
    delegate: string | null;
    constructor(fields: Partial<ContractStateStruct>) {
        Object.assign(this, fields);
    }
}

// Define classes to mirror Rust structs
const CriticalFunctionSchema = new Map<any, any>([
    [CriticalFunctionStruct, {
        kind: 'struct',
        fields: [
            ['type', 'string'],
            ['target_pubkey', 'string'],
            ['amount', 'u32'],
            // ... other fields
        ]
    }],
    // ... similarly for other structures
]);

const QueuedFunctionSchema = new Map<any, any>([
    [QueuedFunctionStruct, {
        kind: 'struct',
        fields: [
            ['func', CriticalFunctionStruct],
            ['execution_time', 'bigint'],
            ['cancelled', 'bool'],
            ['initiator', 'string'],
            ['delegate', { kind: 'option', type: 'string' }]
        ]
    }]
]);

const QueueCriticalFunctionSchema = new Map<any, any>([
    [QueueCriticalFunctionStruct, {
        kind: 'struct',
        fields: [
            ['func', CriticalFunctionStruct],
            ['delay_in_seconds', 'bigint']
        ]
    }]
]);


const SCHEMA: Schema = {
    CriticalFunctionStruct: {
        kind: 'struct',
        fields: [
            ['type', 'string'],
            ['target_pubkey', 'string'],
            ['amount', 'u32'],
            // ... other fields
        ]
    },
    QueuedFunctionStruct: {
        kind: 'struct',
        fields: [
            ['func', CriticalFunctionStruct],
            ['execution_time', 'bigint'],
            ['cancelled', 'bool'],
            ['initiator', 'string'],
            ['delegate', { kind: 'option', type: 'string' }]
        ]
    },
    QueueCriticalFunctionStruct: {
        kind: 'struct',
        fields: [
            ['func', CriticalFunctionStruct],
            ['delay_in_seconds', 'bigint']
        ]
    },
    CancelFunctionStruct: {
        kind: 'struct',
        fields: [
            ['function_index', 'u32']
        ]
    },
    SetDelegateStruct: {
        kind: 'struct',
        fields: [
            ['delegate_pubkey', 'string']
        ]
    },
    InstructionStruct: {
        kind: 'enum',
        values: [
            { name: 'QueueCriticalFunction', value: QueueCriticalFunctionStruct },
            { name: 'CancelFunction', value: CancelFunctionStruct },
            { name: 'SetDelegate', value: SetDelegateStruct },
        ]
    },
    ContractStateStruct: {
        kind: 'struct',
        fields: [
            ['queued_functions', { kind: 'array', type: QueuedFunctionStruct }],
            ['delegate', { kind: 'option', type: 'string' }]
        ]
    },
};


// Fund Account
async function fundAccount(accountPubKey: web3.PublicKey) {
    const transaction = new web3.Transaction().add(
        web3.SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: accountPubKey,
            lamports: 10000000,  
        })
    );
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;
    transaction.sign(payer);
    const txId = await connection.sendTransaction(transaction, [payer]);
    console.log(`Transferred funds to ${accountPubKey.toBase58()}`);
}

// sendTransactionwithData 
async function sendTransactionWithData(dataAccount: web3.Keypair, instructionData: Buffer) {
        const transaction = new web3.Transaction().add(
            new web3.TransactionInstruction({
                keys: [
                    { pubkey: dataAccount.publicKey, isSigner: false, isWritable: true },
                ],
                programId: PROGRAM_ID,
                data: instructionData
            })
        );
    
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = payer.publicKey;
        transaction.sign(payer);
    
        try {
            const txId = await connection.sendTransaction(transaction, [payer]);
            console.log(`Transaction sent with txID: ${txId}. Awaiting confirmation...`);
            await connection.confirmTransaction(txId, 'confirmed');
            console.log(`Transaction confirmed with txID: ${txId}`);
        } catch (error) {
            console.error(`Failed to send transaction: ${error.message}`);
        }
    }


async function cancelFunction(dataAccount: web3.Keypair) {
    console.log("Attempting to cancel the withdrawal...");
    const instructionData = Buffer.concat([
        Buffer.from([1]), // Instruction tag for CancelFunction
        Buffer.from(Uint32Array.of(0).buffer) // function_index as a 4-byte buffer, hardcoded as 0
    ]);
    await sendTransactionWithData(dataAccount, instructionData);
}

// check execution
async function checkExecution(dataAccount: web3.Keypair) {
    try {
        const accountInfo = await connection.getAccountInfo(dataAccount.publicKey);
        if (accountInfo.data[0] === 0) {
            console.log("Withdrawal function is queued but not executed.");
        } else if (accountInfo.data[0] === 1) {
            console.log("Withdrawal function was cancelled.");
        } else {
            console.log("Withdrawal function has been executed.");
        }
    } catch (error) {
        console.error(`Failed to check execution: ${(error as any).message}`);
    }
}

// Simplified the setDelegate to use sendTransactionWithData
async function setDelegate(dataAccount: web3.Keypair) {
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

// Function to serialize an instruction to a Buffer
function serializeInstruction(instruction: Instruction): Buffer {
    return Buffer.from(borsh.serialize(SCHEMA, instruction)); 
}

// Function to queue a critical function
async function queueCriticalFunction(criticalFunction, delayInSeconds) {
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

    
    // Create a transaction
    const transaction = new Transaction().add({
        keys: [{ pubkey: PROGRAM_ID, isSigner: false, isWritable: true }],
        programId: PROGRAM_ID,
        data: serializeInstruction({
            type: 'CancelFunction',
            function_index: 0, 
        }),
    });


    // Sign and send the transaction
    await sendAndConfirmTransaction(connection, transaction, [payer]);


async function callCriticalFunction(dataAccount: Keypair, criticalFunction: CriticalFunction, delayInSeconds: bigint): Promise<void> {
    console.log("Function to withdraw all funds initialized...");
    console.log("⚠️ WARNING: Critical function detected, initiating Timelock safety operation...");
    const instruction: Instruction = {
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

    switch(answers.action) {
        case 'Withdraw All Funds':
            const amountInLamports = 1000000; 
            const targetPubkey = "4RT6vQcVUsY8Zre7ciEXe8HLETQzMgqdAcDsMmdjMJCN"; 
            const criticalFunction: CriticalFunction = {
                type: 'WithdrawAllFunds',
                target_pubkey: targetPubkey,
                amount: BigInt(amountInLamports)
            };
            await callCriticalFunction(dataAccount, criticalFunction, BigInt(30));  // 30 second delay
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
