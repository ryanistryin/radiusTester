<?php



$num = 10;

$count = 0;

while ($num < $count) {



if (!fork()) {
	echo "I am a client\n";
}

}


