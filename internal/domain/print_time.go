package domain

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

const maxSafePrintSeconds uint64 = 1<<53 - 1

var printDurationPattern = regexp.MustCompile(`^(?:([0-9]+)d)?[ \t\n\f\r]*(?:([0-9]+)h)?[ \t\n\f\r]*(?:([0-9]+)m)?[ \t\n\f\r]*(?:([0-9]+)s)?$`)

// ParsePrintDuration parses ordered d/h/m/s units and returns decimal hours.
func ParsePrintDuration(input string) (float64, error) {
	value := strings.ToLower(strings.TrimSpace(input))
	parts := printDurationPattern.FindStringSubmatch(value)
	if parts == nil {
		return 0, fmt.Errorf("formato de tempo inválido: %q", input)
	}

	unitSeconds := [...]uint64{86400, 3600, 60, 1}
	var totalSeconds uint64
	for i, part := range parts[1:] {
		if part == "" {
			continue
		}
		value, err := strconv.ParseUint(part, 10, 64)
		if err != nil || value > maxSafePrintSeconds/unitSeconds[i] {
			return 0, fmt.Errorf("duração fora do limite: %q", input)
		}
		componentSeconds := value * unitSeconds[i]
		if totalSeconds > maxSafePrintSeconds-componentSeconds {
			return 0, fmt.Errorf("duração fora do limite: %q", input)
		}
		totalSeconds += componentSeconds
	}
	if totalSeconds == 0 {
		return 0, fmt.Errorf("tempo de impressão deve ser maior que zero")
	}
	return float64(totalSeconds) / 3600, nil
}

// FormatPrintDuration formats decimal hours using integer d/h/m/s units.
func FormatPrintDuration(hours float64) string {
	if math.IsNaN(hours) || math.IsInf(hours, 0) || hours < 0 {
		return strconv.FormatFloat(hours, 'g', -1, 64)
	}
	totalSeconds := math.Round(hours * 3600)
	if totalSeconds > float64(maxSafePrintSeconds) {
		return strconv.FormatFloat(hours, 'g', -1, 64)
	}
	seconds := uint64(totalSeconds)
	days := seconds / 86400
	wholeHours := (seconds % 86400) / 3600
	minutes := (seconds % 3600) / 60
	remainingSeconds := seconds % 60

	var result strings.Builder
	if days > 0 {
		fmt.Fprintf(&result, "%dd", days)
	}
	if wholeHours > 0 {
		fmt.Fprintf(&result, "%dh", wholeHours)
	}
	if minutes > 0 {
		fmt.Fprintf(&result, "%dm", minutes)
	}
	if remainingSeconds > 0 {
		fmt.Fprintf(&result, "%ds", remainingSeconds)
	}
	if result.Len() == 0 {
		return "0s"
	}
	return result.String()
}
