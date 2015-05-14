detex ~/dev/jstyper/report/tex/diss.tex | tr -cd '0-9A-Za-z \n' | wc -w | xargs printf "%'.0f\n"
