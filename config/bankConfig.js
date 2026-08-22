// config/bankConfig.js
const bankConfig = {
    banksToExcludeCarryForward: ['UNION BANK OF INDIA', 'CANARA BANK', 'SBI', 'CITY UNION BANK', 'AXIS BANK', 'BANK OF BARODA', 'KARUR VYSYA BANK', 'INDIAN OVERSEAS BANK', 'TAMILNAD MERCANTILE BANK LTD'], // add banks as needed
    banksToIncludeHeadernWithBroughtForwardToExcludeCarryForward: ['INDIAN BANK'], // add banks as needed --> validated
    banksToIncludeRefineRefNoAndNarration: ['HDFC BANK'], // add banks as needed
    banksToIncludeRefineTransactionIdAndNarration: ['UNION BANK OF INDIA'], // add banks as needed
    banksToIncludeRefineDateAndNarration: ['CITY UNION BANK', 'IDFC FIRST BANK'], // add banks as needed --> validated
    banksToIncludeRefineDateAndDetails: ['INDIAN BANK'], // add banks as needed --> validated
    banksToIncludeOrderChangeOfBalance: ['CITY UNION BANK'], // add banks as needed
    banksToIncludeYAxisInJsonConversion: ['CITY UNION BANK'], // add banks as needed
    banksToIncludeYAxisInJsonConversionGeneric: ['IDFC FIRST BANK'], // add banks as needed
    banksToIncludeMergeNarrationLines: ['HDFC BANK'], // add banks as needed
    banksToIncludeMergeTransactionDetails: ['IDFC FIRST BANK'], // add banks as needed --> validated
    banksToIncludeCarryForwardLogicToreplaceYAxis: ['IDFC FIRST BANK'], // add banks as needed --> validated
    bankshasHeadersInOnePage: ['HDFC BANK', 'ICICI BANK', 'BANK OF INDIA', 'AXIS BANK', 'ANDHRA PRAGATHI GRAMEENA BANK', 'KARUR VYSYA BANK', 'UNION BANK OF INDIA', 'INDIAN OVERSEAS BANK'], // add banks as needed
    bankToIncludeValidateHeaderWithCustomParameter: ['HDFC BANK', 'BANK OF INDIA', 'AXIS BANK', 'KARUR VYSYA BANK'], // add banks as needed
    bankToIncludeValidateHeaderWithMonthName: ['KARUR VYSYA BANK'], // add banks as needed
    banksToIncludeRefineCreditAndBalance: ['CENTRAL BANK OF INDIA'], // add banks as needed
    banksToIncludeRefineChequeAndAccountDescription: ['CENTRAL BANK OF INDIA'], // add banks as needed
    banksToIncludeRefineBranchAndParticulars: ['KARUR VYSYA BANK'], // add banks as needed
    bankToIncludeValidateHeaderWithTransactionId: ['ICICI BANK'], // add banks as needed
    bankToIncludeValidateHeaderWithTimeStamp: ['UNION BANK OF INDIA'], // add banks as needed
    banksToIncludeChangeHeadersXAxisForAmounts: ['UNION BANK OF INDIA', 'INDIAN OVERSEAS BANK', 'ANDHRA PRAGATHI GRAMEENA BANK'], // add banks as needed
    banksToIncludeMergeHeaders: ['CITY UNION BANK', 'ANDHRA PRAGATHI GRAMEENA BANK'], // add banks as needed
    banksToIncludeMergeHeadersInOnePage: ['ANDHRA PRAGATHI GRAMEENA BANK'], // add banks as needed
    banksToIncludeMergeHeadersInOnePageMultipleTimes: ['CANARA BANK'], // add banks as needed
    banksToIncludeParitalMergeHeaders: ['CENTRAL BANK OF INDIA', 'BANK OF BARODA', 'UNION BANK OF INDIA', 'TAMILNAD MERCANTILE BANK LTD', 'CANARA BANK'], // add banks as needed
    banksToIncludeParitalHeaders: ['SBI'], // add banks as needed
    banksToIncludeParitalMergeHeadersWithoutParitalHeaders: ['BANK OF BARODA'], // add banks as needed
    banksToIncludeParitalMergeHeadersWithDifferentSpaces: ['TAMILNAD MERCANTILE BANK LTD'], // add banks as needed
    banksToIncludeHorizontalLine: ['BANK OF INDIA', 'INDIAN OVERSEAS BANK'], // add banks as needed
    banksToIncludeHeadersInMultipleLines: ['ICICI BANK'], // add banks as needed
    banksToIncludeHeadernWithEpsilionVaration: ['IDFC FIRST BANK'], // add banks as needed --> validated
    banksToIncludeHeadernWithEpsilionChangeWithTwoDates: ['INDIAN OVERSEAS BANK'], // add banks as needed --> validated
    banksToIncludeHeadernWithEpsilionVarationWithLatestFormat: ['SBI'], // add banks as needed --> validated
    banksToIncludeHeadernWithEpsilionVarationWithTwoTypesOfHeaders: ['INDIAN BANK'], // add banks as needed --> validated
    banksToFilterUnnecessaryDataWithtableEndY: ['SBI'], // add banks as needed --> validated
    banksToFilterMultipleHeaderInSamePage: ['UNION BANK OF INDIA', 'TAMILNAD MERCANTILE BANK LTD'], // add banks as needed --> validated
    banksToIncludeHeadersAlign: ['BANK OF INDIA', 'HDFC BANK', 'KARUR VYSYA BANK'], // add banks as needed
    banksToIncludeChangeHeadersAlign: ['HDFC BANK'], // add banks as needed
    banksToIncludeChangeHeadersAlignWithAmounts: ['KARUR VYSYA BANK'], // add banks as needed
    banksToIncludeHeadersAlignChangeXAxis: ['AXIS BANK'], // add banks as needed
    banksToIncludeOrderChangeOfRemarks: ['BANK OF INDIA'], // add banks as needed
    bankHeaders: {
        'UNION BANK OF INDIA': [
            ["S.No", "Date", "Transaction Id", "Remarks", "Amount(Rs.)", "Balance(Rs.)"],
            ["Date", "Transaction Id", "Remarks", "Amount(", "Balance("],
            ["Date", "Description", "Instrument No", "Withdrawals(Rs.)", "Deposits(Rs.)", "Balance(Rs.)"],
            ["DATE", "PARTICULARS", "CHQ.NO.", "WITHDRAWALS", "DEPOSITS", "BALANCE"]
        ],
        'CANARA BANK': [
            [
                'Txn Date', 'Value Date', 'Cheque No.', 'Description',
                'Branch', 'Debit', 'Credit', 'Balance'
            ],
            [
                'Date', 'Particulars', 'Deposits', 'Withdrawals', 'Balance'
            ],
            [
                'TRANS', 'VALUE', 'BRANCH', 'REF/CHQ.NO',
                'DESCRIPTION', 'WITHDRAWS', 'DEPOSIT', 'BALANCE'
            ],
            [
                'Txn Date', 'Value Date', 'Particulars',
                'Debit', 'Credit', 'Balance'
            ],
        ],
        'SBI': [
            ['Txn Date', 'Value', 'Description', 'Ref No./Cheque',
                'Debit', 'Credit', 'Balance'],
            ['Txn Date', 'Value Date', 'Description', 'Ref/Cheque',
                'Debit', 'Credit', 'Balance'],
            ['Txn Date', 'Value Date', 'Description', 'Ref No./Cheque', 'Code',
                'Debit', 'Credit', 'Balance'],
            ['Txn', 'Value', 'Description', 'Ref', 'Branch',
                'Debit', 'Credit', 'Balance'],
            ['Post Date', 'Value Date', 'Description', 'Cheque',
                'Debit', 'Credit', 'Balance'],
            ['Date', 'Details', 'Ref No./Cheque',
                'Debit', 'Credit', 'Balance'],
            ['Value Date', 'Post Date', 'Details', 'Ref No./Cheque',
                'Debit', 'Credit', 'Balance'],
            ['Txn Date', 'Value Date', 'Description',
                'Debit', 'Credit', 'Balance'],
        ],
        'INDIAN BANK': [
            ["Date", "Transaction Details", "Debits", "Credits", "Balance"],
            ["Post Date", "Date", "Details", "Chq.No.", "Debit", "Credit", "Balance"],
            ["Post Date", "Value", "Details", "Chq.No.", "Debit", "Credit", "Balance"],
            ["Post", "Date", "Details", "Chq.No.", "Debit", "Credit", "Balance"],
            ["Post", "Value", "Details", "Chq.No.", "Debit", "Credit", "Balance"],
            ["Post Date", "Value Date", "Details", "Chq.No.", "Debit", "Credit", "Balance"],
            ["Value", "Post", "Remitter", "Description", "Cheque No", "DR", "CR", "Balance"],
            ["Value", "Post", "Credit Amount", "Debit Amount", "Closing Balance", "Description"]
        ],
        'HDFC BANK': [
            ["Date", "Narration", "Chq./Ref.No.", "Value", "Withdrawal", "Deposit", "Balance"],
            ["Date", "Narration", "Chq. / Ref No.", "Value Date", "Withdrawal Amount", "Deposit Amount", "Closing Balance*"]
        ],
        'ICICI BANK': [
            ["Sl", "Id", "Value", "Transaction", "Posted", "Cheque no /", "Remarks", "Withdra", "Deposit", "Balance"],
            ["Sr", "ID", "Value", "Transaction", "Cheque", "Remarks", "Withdrawl", "Deposit", "Balance"],
            ["S.no", "ID", "date", "Cheque No", "Description", "Withdrawal", "Deposit", "Available"],
            ["Date", "Particulars", "Chq.No.", "Withdrawals", "Deposits", "Autosweep", "Balance(INR)"],
            ["DATE", "MODE**", "PARTICULARS", "DEPOSITS", "WITHDRAWALS", "BALANCE"]
        ],
        'IDFC FIRST BANK': [
            ["Transaction", "Value Date", "Particulars", "Cheque", "Debit", "Credit", "Balance"],
            ["Trans Date and", "Value Date", "Transaction Details", "Ref/Cheque", "Debit", "Credit", "Balance"]
        ],
        'BANK OF INDIA': [
            ["Sr No", "Date", "Remarks", "Debit", "Credit", "Balance"],
            ["DATE", "PARTICULARS", "CHQ-NO", "Debit", "Credit", "Available Bal."],
            ["Date", "Tran", "Ref Num", "Particulars", "Debit Amt.", "Credit Amt.", "Balance Amt."]
        ],
        'AXIS BANK': [
            ["Tran Date", "Chq No", "Particulars", "Debit", "Credit", "Balance", "Init."]
        ],
        'CITY UNION BANK': [
            ["Date", "Particulars", "Chq No", "Debit", "Credit", "Balance"],
            ["DATE", "DESCRIPTION", "CHEQUE NO", "DEBIT", "CREDIT", "BALANCE"]
        ],
        'CENTRAL BANK OF INDIA': [
            ["Value", "Post", "Details", "Chq.No.", "Debit", "Credit", "Balance"],
            ["Post Date", "Value", "Branch", "Cheque", "Account Description", "Debit", "Credit", "Balance"],
            ["Post Date", "Value", "Branch", "Cheque", "Transaction Description", "Debit", "Credit", "Balance"]
        ],
        'ANDHRA PRAGATHI GRAMEENA BANK': [
            ["Post Date", "Value Date", "Details", "Chq no", "Debit", "Credit", "Balance"],
            ["Tran. Date", "Inst. No", "Tran. Particulars", "Debit in Rs.", "Credit in Rs.", "Balance in Rs."],
            ["Tran. Date", "Inst. No", "Tran. Particulars", "Debit in", "Credit in", "Balance in Rs."],
            ["Tran. Date", "Inst. No", "Tran. Particulars", "Debit in Rs.", "Credit in", "Balance in Rs."]
        ],
        'BANK OF BARODA': [
            ["DATE", "PARTICULARS", "CHQ.NO.", "WITHDRAWALS", "DEPOSITS", "BALANCE"],
            ["Serial", "Transaction", "Value", "Description", "Cheque", "Debit", "Credit", "Balance"],
            ["DATE", "NARRATION", "CHQ.NO.", "WITHDRAWAL (DR)", "DEPOSIT (CR)", "BALANCE"]
        ],
        'KARUR VYSYA BANK': [
            ["Txn", "Value", "Brn", "Particulars", "Ref. No", "Debit", "Credit", "Balance"],
            ["TXN DATE", "VALUE DATE", "DESCRIPTION", "DEBIT", "CREDIT", "BALANCE"],
            ["Txn Date", "Value Date", "Particulars", "Ref. No.", "Debit", "Credit", "Balance"],
        ],
        'TAMILNAD MERCANTILE BANK LTD': [
            ["TRAN", "VALUE_DATE", "PARTICULARS", "CHQ.NO.", "WITHDRAWALS", "DEPOSITS", "BALANCE"]
        ],
        'INDIAN OVERSEAS BANK': [
            ["Date(Value", "Particulars", "Ref No.", "Type", "Debit(Rs)", "Credit(Rs)", "Balance(Rs)"],
            ["Date", "Tran", "Ref Num", "Particulars", "Debit Amt.", "Credit Amt.", "Balance Amt."]
        ],
        // Add more banks dynamically
    },
    // Bank-specific table end marker logic
    bankEndMarkers: {
        'UNION BANK OF INDIA': [
            'Details of statement',
            'Closing Balance',
            /^Page\s+\d+\s+of\s+\d+$/
        ],
        'CANARA BANK': [
            /Page\s+\d+\s+of\s+\d+/i,
            /Page\s+(\d+)/i,
            'Disclaimer:',
            'Closing Balance',
            'Statement Summary :'
        ],
        'SBI': [
            'Please do not share your ATM, Debit/Credit card number, PIN (Personal Identification Number) and OTP (One Time Password)',
            'Please do not share your ATM Debit/Credit card numbe',
            '** This is computer generated statement and does not require a signature.',
            '**This is computer generated statement and does not require a signature.**',
            "Page no.",
            "CLOSING BALANCE",
            "Statement Summary",
            '********* End of Statement **********'
        ],
        'INDIAN BANK': [
            'Ending Balance',
            'Carried Forward',
            'CLOSING BALANCE :',
            'CLOSING BALANCE:'
        ],
        'HDFC BANK': [
            'STATEMENTSUMMARY',
            'STATEMENT SUMMARY :-',
            'Cr Count',
            'Page',
            /Generation Date\s*:\s*\d{2}-[A-Za-z]{3}-\d{2,4}\s+\d{2}:\d{2}/

        ],
        'CITY UNION BANK': [
            /Page\s+\d+\s+of\s+\d+/i,
            'Total',
        ],
        'ICICI BANK': [
            /Page\s+\d+\s+of/i,
            'Page Total',
            'Page Total:',
            'Generated on :',
            '*This is a system-generated statement. Hence, it does not require any signature.',
            'TOTAL'
        ],
        'BANK OF INDIA': [
            'Transaction Date',
            'NOTE:'
        ],
        'AXIS BANK': [
            'Legends :',
            'TRANSACTION TOTAL'
        ],
        'IDFC FIRST BANK': [
            'REGISTERED OFFICE: IDFC FIRST BANK LIMITED, KRM Tower. 7th Floor, No. 1, Harrington Road, Chetpet, C',
            'REGISTERED OFFICE : IDFC FIRST BANK LIMITED, KRM To',
            /Page\s+\d+\s+Of/i
        ],
        'CENTRAL BANK OF INDIA': [
            'CLOSING BALANCE:',
            'CARRIED FORWARD :',
            /^Statement\s+Downloaded\s+By\s+(.+)$/
        ],
        'ANDHRA PRAGATHI GRAMEENA BANK': [
            'Ope Bal',
            'Total',
            'This is a system-generated statement, no signature is required.'
        ],
        'BANK OF BARODA': [
            /^\s*Page Total:/,
            /ABBREVIATIONS/i,
            /Page\s+\d+\s+\|\s+\d+/i,
            'This is a computer-generated statement hence does not require signature. Statement is generated on 06/03/2026 11:57:19 AM (through bob World mobile app) from the system'
        ],
        'KARUR VYSYA BANK': [
            'Statements are sent to customers only where transac',
            'Karur Vysya Bank does not ask for personal security',
            'Total Amount Recovered till date (Principal , Interest, Charges)',
            'Note:',
            /^Page:\s*\d+$/
        ],
        'INDIAN OVERSEAS BANK': [
            /Effective available balance as on\s*(.*)/
        ],
        // Add more banks as needed
    },
    headerYForBank: {
        'SBI': [
            'Txn Date', 'Post Date', 'Date', 'Txn'
        ],
        'ICICI BANK': [
            'Sl', 'Sr', 'S.no', 'Date', "DATE"
        ]
    },
    sbifirstHeaders: ['Txn Date', 'Post Date', 'Txn', 'Balance'],//Except Date format

    headerBootstrapByBank: {
        'SBI': {
            'Balance': ['Value Date', 'Post Date', 'Details', 'Ref No./Cheque',
                'Debit', 'Credit', 'Balance']
        }
    }, excludeHeader: {
        'INDIAN BANK': [
            [
                ["Post", "Value", "Details", "Chq.No.", "Debit", "Credit", "Balance"], ["Date"]
            ],
            [
                ["Post Date", "Value", "Details", "Chq.No.", "Debit", "Credit", "Balance"], ["Date"]
            ]
        ],
        'ICICI BANK': [
            [
                ["S.no", "ID", "date", "Cheque No", "Description", "Withdrawal", "Deposit", "Available"], ["Transaction", "Balance"]
            ]
        ]
    }, bankExclusivePairs: {
        SBI: [
            ['Code', 'Branch'],
        ]
    }

};

module.exports = bankConfig;
