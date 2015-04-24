cd /home/christoph/dev/jstyper/report
for f in $(find . -name '*.tex' -mmin -5)
	do printf "$(date +%s),$(detex $f | tr -cd '0-9A-Za-z \n' | wc -w -m | sed -r 's/^\s*//;s/\s+/,/g;s/\s*$//'),$(wc -w -l -m < $f | sed -r 's/^\s*//;s/\s+/,/g;s/\s*$//'),$f\n" >> wordcount.csv
done;
