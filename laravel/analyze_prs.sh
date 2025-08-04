#!/bin/bash

# Script to analyze PR sizes in the Laravel repository
# This script extracts merged PRs and calculates statistics on their sizes

echo "Analyzing PR sizes in the Laravel repository..."

# Get all merge commits
echo "Extracting merge commits..."
git log --merges --format="%H" > merge_commits.txt

# Process each merge commit to get PR size
echo "Calculating PR sizes..."
> pr_sizes.txt

count=0
total_commits=$(wc -l < merge_commits.txt)

while IFS= read -r commit; do
  count=$((count + 1))
  echo -ne "Processing commit $count/$total_commits\r"
  
  # Get the parent commits
  parents=$(git show -s --format="%P" $commit)
  parent_array=($parents)
  
  if [ ${#parent_array[@]} -eq 2 ]; then
    # This is a merge commit with two parents
    merge_base=$(git merge-base ${parent_array[0]} ${parent_array[1]})
    
    # Get the PR branch (usually the second parent)
    pr_branch=${parent_array[1]}
    
    # Calculate the diff stats from merge base to PR branch
    stats=$(git diff --shortstat $merge_base $pr_branch)
    
    # Extract numbers from stats
    if [[ $stats =~ ([0-9]+)\ files?\ changed(,\ ([0-9]+)\ insertions?\(\+\))?(,\ ([0-9]+)\ deletions?\(\-\))? ]]; then
      files=${BASH_REMATCH[1]:-0}
      insertions=${BASH_REMATCH[3]:-0}
      deletions=${BASH_REMATCH[5]:-0}
      
      # Calculate total lines changed
      total_lines=$((insertions + deletions))
      
      # Only consider PRs with actual changes
      if [ $total_lines -gt 0 ]; then
        echo "$commit,$files,$insertions,$deletions,$total_lines" >> pr_sizes.txt
      fi
    fi
  fi
done < merge_commits.txt

# Calculate statistics
echo -e "\nCalculating statistics..."

# Sort PR sizes by total lines changed
sort -t, -k5,5n pr_sizes.txt > pr_sizes_sorted.txt

# Count total PRs
total_prs=$(wc -l < pr_sizes.txt)
echo "Total PRs analyzed: $total_prs"

if [ $total_prs -eq 0 ]; then
  echo "No PR data found. Exiting."
  exit 1
fi

# Calculate median
median_line=$((total_prs / 2 + 1))
median_pr=$(sed "${median_line}q;d" pr_sizes_sorted.txt)
IFS=',' read -r _ _ _ _ median_size <<< "$median_pr"
echo "Median PR size: $median_size lines changed"

# Calculate average
total_lines=0
while IFS=',' read -r _ _ _ _ lines; do
  total_lines=$((total_lines + lines))
done < pr_sizes.txt
average_size=$((total_lines / total_prs))
echo "Average PR size: $average_size lines changed"

# Calculate min and max
min_pr=$(head -n 1 pr_sizes_sorted.txt)
IFS=',' read -r _ _ _ _ min_size <<< "$min_pr"
echo "Minimum PR size: $min_size lines changed"

max_pr=$(tail -n 1 pr_sizes_sorted.txt)
IFS=',' read -r _ _ _ _ max_size <<< "$max_pr"
echo "Maximum PR size: $max_size lines changed"

# Calculate percentiles (25th, 75th, 90th, 95th)
percentile_25=$((total_prs * 25 / 100))
percentile_75=$((total_prs * 75 / 100))
percentile_90=$((total_prs * 90 / 100))
percentile_95=$((total_prs * 95 / 100))

percentile_25_pr=$(sed "${percentile_25}q;d" pr_sizes_sorted.txt)
IFS=',' read -r _ _ _ _ percentile_25_size <<< "$percentile_25_pr"
echo "25th percentile: $percentile_25_size lines changed"

percentile_75_pr=$(sed "${percentile_75}q;d" pr_sizes_sorted.txt)
IFS=',' read -r _ _ _ _ percentile_75_size <<< "$percentile_75_pr"
echo "75th percentile: $percentile_75_size lines changed"

percentile_90_pr=$(sed "${percentile_90}q;d" pr_sizes_sorted.txt)
IFS=',' read -r _ _ _ _ percentile_90_size <<< "$percentile_90_pr"
echo "90th percentile: $percentile_90_size lines changed"

percentile_95_pr=$(sed "${percentile_95}q;d" pr_sizes_sorted.txt)
IFS=',' read -r _ _ _ _ percentile_95_size <<< "$percentile_95_pr"
echo "95th percentile: $percentile_95_size lines changed"

# Calculate standard deviation
sum_squared_diff=0
while IFS=',' read -r _ _ _ _ lines; do
  diff=$((lines - average_size))
  squared_diff=$((diff * diff))
  sum_squared_diff=$((sum_squared_diff + squared_diff))
done < pr_sizes.txt
variance=$((sum_squared_diff / total_prs))
std_dev=$(echo "sqrt($variance)" | bc)
echo "Standard deviation: $std_dev lines changed"

# Generate histogram data
echo -e "\nGenerating histogram data..."
echo "PR Size Range,Count" > histogram.csv
echo "1-10,$(grep -c ',[0-9],\|,10,' pr_sizes.txt)" >> histogram.csv
echo "11-50,$(grep -c ',[1-4][0-9],\|,50,' pr_sizes.txt)" >> histogram.csv
echo "51-100,$(grep -c ',[5-9][0-9],\|,100,' pr_sizes.txt)" >> histogram.csv
echo "101-500,$(grep -c ',[1-4][0-9][0-9],\|,500,' pr_sizes.txt)" >> histogram.csv
echo "501-1000,$(grep -c ',[5-9][0-9][0-9],\|,1000,' pr_sizes.txt)" >> histogram.csv
echo "1001+,$(grep -c ',[1-9][0-9][0-9][0-9],' pr_sizes.txt)" >> histogram.csv

echo -e "\nHistogram of PR sizes:"
cat histogram.csv

# Clean up temporary files
rm merge_commits.txt pr_sizes.txt pr_sizes_sorted.txt histogram.csv

echo -e "\nAnalysis complete!"