// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.7;

// ----------------------------------------------------------------------------
// Adapted from BokkyPooBah's DateTime Library v1.01 | BokkyPooBah / Bok Consulting Pty Ltd 2018-2019. The MIT Licence.
//
// A gas-efficient Solidity date and time library
//
// https://github.com/bokkypoobah/BokkyPooBahsDateTimeLibrary
// ----------------------------------------------------------------------------
library SubscriptionChargeDate {
    uint256 constant SECONDS_PER_DAY = 24 * 60 * 60;
    uint256 constant SECONDS_PER_HOUR = 60 * 60;
    int256 constant OFFSET19700101 = 2440588;

    struct Date {
        uint8 day;
        uint8 month;
        uint32 year;
        uint256 timestamp;
    }

    // ------------------------------------------------------------------------
    // Calculate year/month/day from the number of days since 1970/01/01 using
    // the date conversion algorithm from
    //   http://aa.usno.navy.mil/faq/docs/JD_Formula.php
    // and adding the offset 2440588 so that 1970/01/01 is day 0
    //
    // int L = days + 68569 + offset
    // int N = 4 * L / 146097
    // L = L - (146097 * N + 3) / 4
    // year = 4000 * (L + 1) / 1461001
    // L = L - 1461 * year / 4 + 31
    // month = 80 * L / 2447
    // dd = L - 2447 * month / 80
    // L = month / 11
    // month = month + 2 - 12 * L
    // year = 100 * (N - 49) + year + L
    // ------------------------------------------------------------------------
    function _daysToDate(uint256 _days)
        internal
        pure
        returns (
            uint32 year,
            uint8 month,
            uint8 day
        )
    {
        int256 __days = int256(_days);

        int256 L = __days + 68569 + OFFSET19700101;
        int256 N = (4 * L) / 146097;
        L = L - (146097 * N + 3) / 4;
        int256 _year = (4000 * (L + 1)) / 1461001;
        L = L - (1461 * _year) / 4 + 31;
        int256 _month = (80 * L) / 2447;
        int256 _day = L - (2447 * _month) / 80;
        L = _month / 11;
        _month = _month + 2 - 12 * L;
        _year = 100 * (N - 49) + _year + L;

        year = uint32(uint256(_year));
        month = uint8(uint256(_month));
        day = uint8(uint256(_day));
    }

    /**
     * @notice Check if a monthly subscription is ready to be paid,
     *   given the current date and the number of payments
     * @param timestamp The current timestamp
     * @param refTimestamp The start date of the subscription
     * @param paymentCount The number of payments that have occured to date
     */
    function validMonthsSince(
        uint256 timestamp,
        uint256 refTimestamp,
        uint128 paymentCount
    ) internal pure returns (bool) {
        Date memory date = toDate(timestamp);
        Date memory refDate = toDate(refTimestamp);
        uint256 difference = diffMonths(refDate, date);
        if (difference < paymentCount) return false;

        uint8 comparisonDay = refDate.day;
        if (refDate.day >= 29) {
            uint8 daysInMonth = getDaysInMonth(date.year, date.month);
            // If the payment date is greater than the number of days in the month,
            // allow the payment to be made on the last day of the month
            if (daysInMonth < refDate.day) comparisonDay = daysInMonth;
        }

        return date.day >= comparisonDay || difference >= paymentCount + 1;
    }

    /**
     * @notice Check if a weekly subscription is ready to be paid,
     *   given the current date and the number of payments
     * @param timestamp The current timestamp
     * @param refTimestamp The start date of the subscription
     * @param paymentCount The number of payments that have occured to date
     */
    function validWeeksSince(
        uint256 timestamp,
        uint256 refTimestamp,
        uint128 paymentCount
    ) internal pure returns (bool) {
        uint256 dayOfWeek = getDayOfWeek(timestamp);
        uint256 refDayOfWeek = getDayOfWeek(refTimestamp);
        uint256 weeksBetween = diffWeeks(refTimestamp, timestamp);
        if (weeksBetween < paymentCount) return false;
        return dayOfWeek >= refDayOfWeek || weeksBetween >= paymentCount + 1;
    }

    /**
     * @notice Check if a daily subscription is ready to be paid,
     *   given the current date and the number of payments
     * @param timestamp The current timestamp
     * @param refTimestamp The start date of the subscription
     * @param paymentCount The number of payments that have occured to date
     */
    function validDaysSince(
        uint256 timestamp,
        uint256 refTimestamp,
        uint128 paymentCount
    ) internal pure returns (bool) {
        uint256 hour = getHour(timestamp);
        uint256 refHour = getHour(refTimestamp);
        uint256 difference = diffDays(refTimestamp, timestamp);
        if (difference < paymentCount) return false;
        return hour >= refHour || difference >= paymentCount + 1;
    }

    /**
     * @notice Convert the given timestamp into a Date
     * @param timestamp The current timestamp
     */
    function toDate(uint256 timestamp) internal pure returns (Date memory) {
        (uint32 year, uint8 month, uint8 day) = _daysToDate(timestamp / SECONDS_PER_DAY);
        return Date(day, month, year, timestamp);
    }

    /**
     * @notice Determine how many months apart two given dates are
     * @dev How many months are they apart? ie 30 July and 1 August are 1. 0 Means in the same month
     * @param from The earlier date
     * @param to The later date
     */
    function diffMonths(Date memory from, Date memory to) internal pure returns (uint256 _months) {
        require(from.timestamp <= to.timestamp);
        _months = to.year * 12 + to.month - from.year * 12 - from.month;
    }

    /**
     * @notice Determine the number of days between two timestamps
     * @param from The earlier timestamp
     * @param to The later timestamp
     */
    function diffDays(uint256 from, uint256 to) internal pure returns (uint256 _days) {
        require(from <= to);
        _days = (to - from) / from;
    }

    /**
     * @notice Determine the number of weeks between two timestamps
     * @param from The earlier timestamp
     * @param to The later timestamp
     */
    function diffWeeks(uint256 from, uint256 to) internal pure returns (uint256 _weeks) {
        uint256 difference = diffDays(from, to) + 2;
        _weeks = difference / 7;
    }

    /**
     * @notice Determine which hour of the day the timestamp occurs in
     * @dev The hour runs from 0 - 23
     * @param timestamp The timstamp to get the hour of
     */
    function getHour(uint256 timestamp) internal pure returns (uint256 _hour) {
        uint256 secs = timestamp % SECONDS_PER_DAY;
        _hour = secs / SECONDS_PER_HOUR;
    }

    /**
     * @notice Determine which day of the week the timestamp occurs in
     * @dev 1 = Monday, 7 = Sunday
     * @param timestamp The timstamp to get the day of the week of
     */
    function getDayOfWeek(uint256 timestamp) internal pure returns (uint256 dayOfWeek) {
        uint256 _days = timestamp / SECONDS_PER_DAY;
        dayOfWeek = ((_days + 3) % 7) + 1;
    }

    /**
     * @notice Determine how many days occur in the given month
     * @param year The year that the timestamp occurs in
     * @param month The month that the timestamp occurs in
     */
    function getDaysInMonth(uint32 year, uint8 month) internal pure returns (uint8 daysInMonth) {
        if (month == 1 || month == 3 || month == 5 || month == 7 || month == 8 || month == 10 || month == 12) {
            daysInMonth = 31;
        } else if (month != 2) {
            daysInMonth = 30;
        } else {
            daysInMonth = isLeapYear(year) ? 29 : 28;
        }
    }

    /**
     * @notice Is the current timestamp in a leap year?
     * @param year The year that the timestamp occurs in
     */
    function isLeapYear(uint32 year) internal pure returns (bool leapYear) {
        leapYear = ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0);
    }
}
