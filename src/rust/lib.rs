// lib.rs
// Importing required modules and traits from solana_program and other dependencies
use solana_program::sysvar::clock::Clock;
use solana_program::sysvar::Sysvar;
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    pubkey::Pubkey,
};
use byteorder::{LittleEndian, ReadBytesExt};
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_error::ProgramError;

// Default delay for withdrawing all funds (e.g., 1 hour, 30 seconds here)
const DEFAULT_DELAY_FOR_CRITICAL_FUNCTION: i64 = 30;

// Entrypoint for the program
entrypoint!(process_instruction);

// Enumeration representing critical functions the contract will execute with a Timelock delay
#[derive(Clone, Debug, PartialEq, borsh_derive::BorshDeserialize, borsh_derive::BorshSerialize)]
pub enum CriticalFunction {
    WithdrawAllFunds {
        target_pubkey: Pubkey,
        amount: i64,
    },

    // example function (not implemented)
    DeleteAccount {
    }


}

// State of the contract, maintaining a list of queued functions
#[derive(Clone, Debug, PartialEq, borsh_derive::BorshDeserialize, borsh_derive::BorshSerialize)]
pub struct ContractState {
    pub queued_functions: Vec<QueuedFunction>,
    pub delegate: Option<Pubkey>,
}

// Representation of a function that has been queued for execution
#[derive(Clone, Debug, PartialEq, borsh_derive::BorshDeserialize, borsh_derive::BorshSerialize)]
pub struct QueuedFunction {
    pub function: CriticalFunction,
    pub execution_time: i64,
    pub cancelled: bool,
    pub initiator: Pubkey,
    pub delegate: Option<Pubkey>, // Optional trusted delegate
}

// Enumeration representing instructions that the contract can handle
pub enum Instruction {
    QueueCriticalFunction { function: CriticalFunction, delay_in_seconds: i64 },
    CancelFunction { function_index: usize },
    CheckExecution,
    SetDelegate { delegate_pubkey: Pubkey },
}

impl Instruction {
    // Function to unpack the instruction from the given byte slice
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&tag, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match tag {
            0 => {
                let function = CriticalFunction::try_from_slice(rest)?;
                let delay_in_seconds = rest[rest.len() - 8..]
                    .as_ref()
                    .read_i64::<LittleEndian>()
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                Self::QueueCriticalFunction { function, delay_in_seconds }
            }
            1 => {
                let function_index = rest.as_ref()
                    .read_u64::<LittleEndian>()
                    .map_err(|_| ProgramError::InvalidInstructionData)? as usize;
                Self::CancelFunction { function_index }
            }
            2 => Self::CheckExecution,
            3 => {
                let delegate_pubkey = Pubkey::try_from(&rest[0..32])
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                Self::SetDelegate { delegate_pubkey }
            }
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}

// Function to queue a critical function with the desired delay
pub fn queue_function(
    accounts: &[AccountInfo],
    function: CriticalFunction,
    delay_in_seconds: i64,
) -> ProgramResult {
    let account = &accounts[0];
    let mut state: ContractState = if account.data_len() > 0 {
        ContractState::try_from_slice(&account.data.borrow())?
    } else {
        ContractState { queued_functions: Vec::new(), delegate: None }
    };
    let clock = Clock::from_account_info(&accounts[1])?;
    let current_time = clock.unix_timestamp;
    let execution_time = current_time + delay_in_seconds;

    let queued_function = QueuedFunction {
        function,
        execution_time,
        cancelled: false,
        initiator: *account.key,
        delegate: None,
    };

    state.queued_functions.push(queued_function);
    state.serialize(&mut &mut account.data.borrow_mut()[..])?;

    Ok(())
}

// Main function to process instructions sent to the program
fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = Instruction::unpack(instruction_data)?;

match instruction {
    Instruction::QueueCriticalFunction { function, delay_in_seconds: _ } => {
        // Determine the actual delay based on the type of critical function
        let actual_delay = match &function {
            CriticalFunction::WithdrawAllFunds { .. } => DEFAULT_DELAY_FOR_CRITICAL_FUNCTION,
            CriticalFunction::DeleteAccount { .. } => {
                DEFAULT_DELAY_FOR_CRITICAL_FUNCTION
            }
        };
        
        queue_function(accounts, function, actual_delay)?;
    },
    Instruction::CancelFunction { function_index } => {
        // Handling the CancelFunction instruction
        msg!("Received instruction to cancel function at index {}", function_index);
        let account = &accounts[0];
        let mut state: ContractState = ContractState::try_from_slice(&account.data.borrow())?;
        if function_index < state.queued_functions.len() {
            let queued_func = &state.queued_functions[function_index];
            if *account.key != queued_func.initiator && Some(*account.key) != queued_func.delegate {
                return Err(ProgramError::InvalidAccountData); // or a more descriptive error
            }
            state.queued_functions[function_index].cancelled = true;
            state.serialize(&mut &mut account.data.borrow_mut()[..])?;
        } else {
            return Err(ProgramError::InvalidInstructionData);
        }
    },
    Instruction::SetDelegate { delegate_pubkey } => {
        let account = &accounts[0];
        let mut state: ContractState = ContractState::try_from_slice(&account.data.borrow())?;
        state.delegate = Some(delegate_pubkey);
        state.serialize(&mut &mut account.data.borrow_mut()[..])?;
    },
    Instruction::CheckExecution => {
        // Checking if any queued function should be executed based on current time
        let account = &accounts[0];
        let mut state: ContractState = ContractState::try_from_slice(&account.data.borrow())?;
        let clock = Clock::from_account_info(&accounts[1])?;
        let current_time = clock.unix_timestamp;

        let mut functions_to_remove = Vec::new();

        for (index, func) in state.queued_functions.iter().enumerate() {
            if !func.cancelled && func.execution_time <= current_time {
                match &func.function {
                    CriticalFunction::WithdrawAllFunds { amount, target_pubkey } => {
                        msg!("Executing WithdrawFunds function. Amount: {}. Target Pubkey:{}", amount, target_pubkey);
                        msg!("Sending the transfer of {} lamports to {}", amount, target_pubkey); 
                        functions_to_remove.push(index);
                    },
                    CriticalFunction::DeleteAccount { .. } => {
                        msg!("Executing DeleteAccount function..");
                        functions_to_remove.push(index);
                    }
                }
            }
        }

        // Removing executed functions in reverse order to avoid shifting indices
        for index in functions_to_remove.iter().rev() {
            state.queued_functions.remove(*index);
        }

        state.serialize(&mut &mut account.data.borrow_mut()[..])?;
    }
} 


    Ok(())
}
