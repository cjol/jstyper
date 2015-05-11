# table headers
echo "name, oTime, oBytes, oAlloc, oDealloc, cTime, cBytes, cAlloc, cDealloc, mimics, guards, mimicReadProps, mimicWriteProps, mimicFunCalls, guardReadProps, guardWriteProps, guardFunCalls"; 

while read p; do
	a=($p); 
	#echo $p;
	echo ${a[1]}, $(node profile.js ${a[0]}/tests/${a[1]}), $(node profile.js ${a[0]}/compiled/${a[1]}), $(node profile.js -count ${a[0]}/compiled/${a[1]}) ;
done < toProfile.txt
