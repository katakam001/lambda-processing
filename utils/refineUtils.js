const refineRefNoAndNarration = (
    item,
    narrationX,
    refNoX
) => {

    const isValidRefNo = text => {
        const cleaned = text.trim();
        return (
            /^\d{16}$/.test(cleaned) || // regular 16-digit Ref.No.
            /^[A-Z]{1,3}[A-Z\d]{13,15}$/.test(cleaned) || // 16-char alphanumeric with 1–3 letter prefix
            cleaned === "000000000000000" // special 15-digit all-zero override
        );
    };

    if (item.x === refNoX && !isValidRefNo(item.text)) {
        // Mis-snapped narration at Ref.No. position
        return { ...item, x: narrationX };
    }
    return item;
};

const refineChequeAndNarration = (
    item,
    narrationX,
    chequeX
) => {
    const isValidChequeNo = text => {
        const cleaned = text.trim();
        return /^\d{6}$/.test(cleaned); // 6-digit numeric cheque number
    };

    if (item.x === chequeX && !isValidChequeNo(item.text)) {
        // Mis-snapped narration at cheque position
        return { ...item, x: narrationX };
    }

    return item;
};

const refineBranchAndNarration = (
    item,
    narrationX,
    branchX
) => {
    const isValidBranchCode = text => {
        const cleaned = text.trim();
        return /^\d{4}$/.test(cleaned); // 4-digit numeric branch code
    };

    if (item.x === branchX && !isValidBranchCode(item.text)) {
        // Mis-snapped narration at branch position
        return { ...item, x: narrationX };
    }

    return item;
};


const refineTransactionIdAndRemarks = (item, narrationX, refNoX) => {
    const isValidRefNo = text => {
        const cleaned = text.trim();

        return (
            (cleaned.startsWith("S") && cleaned.length >= 6 && cleaned.length <= 9) ||
            (cleaned.startsWith("A") && cleaned.length >= 6 && cleaned.length <= 8) ||
            /^[A-Z][0-9]{6}$/.test(cleaned)
            || /^[A-Z][0-9]{8}$/.test(cleaned)
        );
    };

    if (item.x === refNoX && !isValidRefNo(item.text)) {
        // Mis-snapped narration at Ref.No. position
        return { ...item, x: narrationX };
    }

    return item;
};

const refineDateAndParticulars = (
    item,
    ParticularsX,
    dateX
) => {
    const isValidDate = text =>
        /^\d{2}-[A-Za-z]{3}-\d{4}$/.test(text.trim()); // e.g., 01-FEB-2025

    if (item.x === dateX && !isValidDate(item.text)) {
        // Mis-snapped narration or non-date at Date position
        return { ...item, x: ParticularsX };
    }

    return item;
};

const refineValueDateAndParticulars = (
    item,
    ParticularsX,
    dateX
) => {
    // ✅ Accept both DD/MM/YY and DD/MM/YYYY
    const isValidDate = text =>
        /^(\d{2}\/\d{2}\/\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})$/.test(text.trim());

    if (item.x === dateX && !isValidDate(item.text)) {
        // Mis-snapped narration or non-date at Date position
        return { ...item, x: ParticularsX };
    }

    return item;
};

const refineValueDateWithHypenAndParticulars = (
    item,
    ParticularsX,
    dateX
) => {
    // ✅ Accept dates like 01-02-2026
    const isValidDate = text =>
        /^\d{2}-\d{2}-\d{4}$/.test(text.trim()); // e.g., 01-02-2026

    if (item.x === dateX && !isValidDate(item.text)) {
        // Mis-snapped narration or non-date at Date position
        return { ...item, x: ParticularsX };
    }

    return item;
};


module.exports = { refineRefNoAndNarration, refineChequeAndNarration, refineBranchAndNarration, refineTransactionIdAndRemarks, refineDateAndParticulars, refineValueDateAndParticulars, refineValueDateWithHypenAndParticulars };